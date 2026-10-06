import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import {
  createPostgresStore,
  ZONA_CLIENT_ID,
} from "../server/postgres-store.js";
import { createApp } from "../server/app.js";
import { quote, calculate } from "../server/pricing.js";
import { mapCatalog } from "../server/neon-catalog.js";
if (!process.env.DATABASE_URL)
  throw Error("Usa la credencial web restringida en DATABASE_URL.");
const store = createPostgresStore(process.env.DATABASE_URL, {
  schema: "zona_fresca_web_qa",
});
const ids = [];
const line = () => ({
  id: randomUUID(),
  productId: "copa-zf",
  quantity: 1,
  flavors: { Vainilla: 5 },
  additions: ["cereal"],
  removals: [],
  variant: "",
  note: "QA sintética",
});
const customer = {
  buyer: "QA menú web",
  recipient: "QA destinatario",
  phone: "3000000000",
  address: "Dirección sintética A",
  instructions: "Sin entrega real",
};
async function session() {
  const id = randomBytes(32).toString("hex");
  ids.push(id);
  await store.createSession(id);
  return id;
}
test("Neon: persistencia, aislamiento, transacciones y API con credencial restringida", async (t) => {
  t.after(async () => {
    for (const id of ids) {
      await store.pool.query(
        "DELETE FROM zona_fresca_web_qa.outbox WHERE order_id IN (SELECT id FROM zona_fresca_web_qa.orders WHERE session_id=$1)",
        [id],
      );
      await store.pool.query(
        "DELETE FROM zona_fresca_web_qa.orders WHERE session_id=$1",
        [id],
      );
      await store.pool.query(
        "DELETE FROM zona_fresca_web_qa.sessions WHERE id=$1",
        [id],
      );
    }
    await store.pool.end();
  });
  const catalog = await store.catalog();
  await t.test(
    "catálogo consulta Britech y actualiza precio de adiciones",
    () => {
      assert.equal(catalog.source, "neon");
      assert.equal(catalog.products.find((p) => p.id === "litro").price, 30000);
      assert.equal(
        catalog.additions.find((a) => a.id === "cereal").price,
        2000,
      );
      const q = calculate([line()], catalog.products, catalog.additions);
      assert.equal(q.subtotal, 30000);
    },
  );
  await t.test(
    "no hay acceso directo a pedidos, catálogo ni clientes globales",
    async () => {
      for (const table of ["orders", "menu_items", "clients", "conversations"])
        await assert.rejects(
          store.pool.query(`SELECT * FROM public.${table} LIMIT 0`),
          (e) => e.code === "42501",
        );
    },
  );
  await t.test("el CHECK de cliente bloquea otro tenant", async () => {
    await assert.rejects(
      store.pool.query(
        "INSERT INTO zona_fresca_web_qa.sessions(id,client_id,expires) VALUES($1,$2,now())",
        [randomBytes(32).toString("hex"), randomUUID()],
      ),
      (e) => e.code === "23514",
    );
  });
  const sid = await session(),
    other = await session(),
    cart = [line()];
  await store.withSessionLock(sid, (s) => s.cart(sid, cart));
  await t.test("persiste entre conexiones y aísla sesiones", async () => {
    const second = createPostgresStore(process.env.DATABASE_URL, {
      schema: "zona_fresca_web_qa",
    });
    try {
      assert.deepEqual(JSON.parse((await second.session(sid)).cart), cart);
      assert.deepEqual(JSON.parse((await second.session(other)).cart), []);
    } finally {
      await second.pool.end();
    }
  });
  await t.test(
    "fallo después de insertar pedido revierte pedido, evento y carrito",
    async () => {
      await assert.rejects(
        store.withSessionLock(sid, async (s) => {
          await s.createOrder(
            sid,
            randomUUID(),
            "rollback-test",
            { customer },
            false,
          );
          throw Error("fallo sintético");
        }),
      );
      assert.equal(
        (
          await store.pool.query(
            "SELECT count(*)::int n FROM zona_fresca_web_qa.orders WHERE session_id=$1",
            [sid],
          )
        ).rows[0].n,
        0,
      );
      assert.deepEqual(JSON.parse((await store.session(sid)).cart), cart);
    },
  );
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  async function request(path, body, cookie = sid, method) {
    const r = await fetch(base + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        "X-Zona-Request": "1",
        Cookie: `zf_session=${cookie}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  }
  const q = (
    await request("quote", { method: "delivery", address: customer.address })
  ).data;
  const input = {
    key: randomUUID(),
    quoteToken: q.token,
    method: "delivery",
    customer,
    remember: true,
    payment: "cash",
    cash: "exact",
  };
  let order;
  await t.test(
    "dos confirmaciones concurrentes crean un solo pedido y un evento deshabilitado",
    async () => {
      const [a, b] = await Promise.all([
        request("orders", input),
        request("orders", input),
      ]);
      assert.ok([200, 201].includes(a.status));
      assert.ok([200, 201].includes(b.status));
      assert.equal(a.data.id, b.data.id);
      order = a.data;
      assert.equal(
        (
          await store.pool.query(
            "SELECT count(*)::int n FROM zona_fresca_web_qa.orders WHERE session_id=$1",
            [sid],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await store.pool.query(
            "SELECT status FROM zona_fresca_web_qa.outbox WHERE order_id=$1",
            [order.id],
          )
        ).rows[0].status,
        "disabled_demo",
      );
    },
  );
  await t.test(
    "reintento no duplica; otra carga con la misma clave se rechaza",
    async () => {
      assert.equal((await request("orders", input)).data.id, order.id);
      assert.equal(
        (await request("orders", { ...input, remember: false })).status,
        409,
      );
    },
  );
  await t.test(
    "perfil se recuerda solo en esa sesión y puede olvidarse",
    async () => {
      assert.deepEqual((await request("bootstrap")).data.profile, customer);
      assert.equal(
        (await request("bootstrap", undefined, other)).data.profile,
        null,
      );
      await request("profile", {}, sid, "DELETE");
      assert.equal((await request("bootstrap")).data.profile, null);
    },
  );
  await t.test(
    "cambio de catálogo cambia el precio y el consentimiento",
    () => {
      const before = quote(
        cart,
        "pickup",
        "",
        catalog.products,
        catalog.additions,
      );
      const updated = catalog.products.map((p) =>
        p.id === "copa-zf" ? { ...p, price: p.price + 1000 } : p,
      );
      assert.notEqual(
        quote(cart, "pickup", "", updated, catalog.additions).token,
        before.token,
      );
    },
  );
});
