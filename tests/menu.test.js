import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { products } from "../server/catalog.js";
import { calculate, quote } from "../server/pricing.js";
import { createStore, processOutbox } from "../server/store.js";
import { createApp } from "../server/app.js";
const line = (id = "copa-zf", scoops = 4, other = {}) => ({
  id: randomUUID(),
  productId: id,
  quantity: 1,
  flavors: scoops ? { Vainilla: scoops } : {},
  additions: [],
  removals: [],
  variant: "",
  note: "",
  ...other,
});
const customer = {
  buyer: "Persona prueba",
  recipient: "Destinatario prueba",
  phone: "3000000000",
  address: "Calle sintética 123",
  instructions: "Prueba aislada",
};
async function fixture(t) {
  const store = createStore(":memory:");
  const server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => {
    server.close();
    store.db.close();
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = "";
    return async (path, body, method) => {
      const r = await fetch(`${url}/api/${path}`, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          cookie,
          "Content-Type": "application/json",
          "X-Zona-Request": "1",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      cookie = r.headers.get("set-cookie")?.split(";")[0] || cookie;
      return { status: r.status, data: await r.json(), cookie };
    };
  };
  return { store, client, url };
}
test("Copa: 4 bolas de un mismo sabor no generan extras", () => {
  const q = calculate([line()]);
  assert.equal(q.subtotal, 24000);
  assert.equal(q.extras, 0);
});
test("Copa: 5 bolas cobran exactamente una adicional de demostración", () => {
  const q = calculate([line("copa-zf", 5)]);
  assert.equal(q.extras, 4000);
  assert.equal(q.subtotal, 28000);
});
test("6 bananas conservan personalizaciones por grupos sin descuentos", () => {
  const q = calculate([
    line("banana-split", 3, { removals: ["banano"] }),
    line("banana-split", 3, { removals: ["queso"] }),
    line("banana-split", 0, { removals: ["helado"] }),
    line("banana-split", 3, { quantity: 3 }),
  ]);
  assert.equal(q.count, 6);
  assert.equal(q.subtotal, 6 * 19000);
  assert.equal(q.lines.length, 4);
});
test("rechaza sabores inválidos, fracciones, adiciones ajenas y precios inyectados", () => {
  for (const value of [
    line("copa-zf", 3),
    line("copa-zf", 4, { flavors: { inventado: 4 } }),
    line("copa-zf", 4, { quantity: 1.5 }),
    line("copa-zf", 4, { additions: ["proteina"] }),
    { ...line(), price: 1 },
  ])
    assert.throws(() => calculate([value]));
});
test("agotados y precio desconocido no se venden", () => {
  assert.throws(() => calculate([line("gaseosa", 0)]));
  assert.throws(() => calculate([line("litro", 0)]));
});
test("litro admite un único sabor cuando el catálogo confirma precio", () => {
  const catalog = products.map((p) =>
    p.id === "litro" ? { ...p, available: true, price: 20000 } : p,
  );
  assert.equal(calculate([line("litro", 1)], catalog).subtotal, 20000);
  assert.throws(() =>
    calculate(
      [line("litro", 1, { flavors: { Vainilla: 1, Chocolate: 1 } })],
      catalog,
    ),
  );
});
test("malteadas, café y batido incluyen exactamente una bola", () => {
  for (const id of ["malteada-zf", "malteada-sencilla", "cafe", "batido"])
    assert.equal(products.find((p) => p.id === id).includedScoops, 1);
});
test("las arepas requieren escoger una variedad concreta", () => {
  assert.throws(() => calculate([line("arepa", 0)]));
  assert.equal(calculate([line("arepa-zf", 0)]).subtotal, 25000);
});
test("sin dirección no hay total definitivo para domicilio", () => {
  const q = quote([line()], "delivery", "");
  assert.equal(q.total, null);
  assert.equal(q.subtotal, 24000);
  assert.equal(q.delivery.fee, null);
});
test("precio actualizado cambia el token de aceptación", () => {
  const cart = [line()];
  const before = quote(cart);
  const after = quote(
    cart,
    "pickup",
    "",
    products.map((p) => (p.id === "copa-zf" ? { ...p, price: 26000 } : p)),
  );
  assert.notEqual(before.token, after.token);
});
test("catálogo sin datos personales, carrito recuperable y sesiones aisladas", async (t) => {
  const { client } = await fixture(t);
  const a = client(),
    b = client();
  const first = await a("bootstrap");
  assert.equal(first.status, 200);
  assert.ok(first.cookie.startsWith("zf_session="));
  assert.equal(first.data.profile, null);
  const cart = [line()];
  await a("cart", { cart }, "PUT");
  assert.deepEqual((await a("bootstrap")).data.cart, cart);
  assert.deepEqual((await b("bootstrap")).data.cart, []);
});
test("pedido doble clic es idempotente y pedido/evento quedan juntos", async (t) => {
  const { client, store } = await fixture(t);
  const a = client();
  await a("cart", { cart: [line()] }, "PUT");
  const q = (await a("quote", { method: "pickup", address: "" })).data;
  const payload = {
    key: randomUUID(),
    quoteToken: q.token,
    method: "pickup",
    customer: { ...customer, address: "" },
    remember: false,
    payment: "cash",
    cash: "exact",
  };
  const [x, y] = await Promise.all([
    a("orders", payload),
    a("orders", payload),
  ]);
  assert.equal(x.data.id, y.data.id);
  assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 1);
  assert.equal(store.db.prepare("SELECT count(*) n FROM outbox").get().n, 1);
  assert.equal(x.data.paymentStatus, "pending_collection");
  assert.equal(x.data.status, "received_demo");
  assert.equal((await a("bootstrap")).data.profile, null);
});
test("recordar es opt-in, olvidar elimina perfil, teléfono no recupera otro cliente", async (t) => {
  const { client } = await fixture(t);
  const a = client(),
    b = client();
  await a("cart", { cart: [line()] }, "PUT");
  const q = (
    await a("quote", { method: "delivery", address: customer.address })
  ).data;
  await a("orders", {
    key: randomUUID(),
    quoteToken: q.token,
    method: "delivery",
    customer,
    remember: true,
    payment: "cash",
    cash: "exact",
  });
  assert.deepEqual((await a("bootstrap")).data.profile, customer);
  assert.equal((await b("bootstrap")).data.profile, null);
  await a("profile", {}, "DELETE");
  assert.equal((await a("bootstrap")).data.profile, null);
});
test("dos direcciones crean pedidos independientes con sus tarifas", async (t) => {
  const { client, store } = await fixture(t);
  const a = client();
  const ids = [];
  for (const address of ["Dirección sintética A", "Dirección sintética B"]) {
    await a("cart", { cart: [line()] }, "PUT");
    const q = (await a("quote", { method: "delivery", address })).data;
    const r = await a("orders", {
      key: randomUUID(),
      quoteToken: q.token,
      method: "delivery",
      customer: { ...customer, address },
      remember: false,
      payment: "cash",
      cash: 30000,
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.customer.address, address);
    assert.equal(r.data.total, 29000);
    ids.push(r.data.id);
  }
  assert.notEqual(ids[0], ids[1]);
  assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 2);
});
test("efectivo insuficiente, dirección incompleta y transferencia se rechazan", async (t) => {
  const { client } = await fixture(t);
  const a = client();
  await a("cart", { cart: [line()] }, "PUT");
  const q = (await a("quote", { method: "pickup", address: "" })).data;
  const base = {
    key: randomUUID(),
    quoteToken: q.token,
    method: "pickup",
    customer,
    remember: false,
    payment: "cash",
    cash: 100,
  };
  assert.equal((await a("orders", base)).status, 400);
  assert.equal(
    (await a("orders", { ...base, cash: "exact", payment: "transfer" })).status,
    400,
  );
  assert.equal(
    (
      await a("orders", {
        ...base,
        method: "delivery",
        customer: { ...customer, address: "" },
      })
    ).status,
    400,
  );
});
test("cambio antes de confirmar pide nuevo consentimiento y no guarda pedido", async (t) => {
  const { client, store } = await fixture(t);
  const a = client();
  await a("cart", { cart: [line()] }, "PUT");
  const q = (await a("quote", { method: "pickup", address: "" })).data;
  await a("cart", { cart: [line("copa-zf", 5)] }, "PUT");
  const r = await a("orders", {
    key: randomUUID(),
    quoteToken: q.token,
    method: "pickup",
    customer,
    remember: false,
    payment: "cash",
    cash: "exact",
  });
  assert.equal(r.status, 409);
  assert.equal(r.data.quote.total, 28000);
  assert.equal(store.db.prepare("SELECT count(*) n FROM orders").get().n, 0);
});
test("fallo del notificador conserva el pedido y limita reintentos", () => {
  const store = createStore(":memory:");
  store.createSession("session");
  const order = store.createOrder(
    "session",
    randomUUID(),
    "hash",
    { customer },
    false,
  );
  for (let n = 0; n < 8; n++)
    processOutbox(
      store,
      () => {
        throw Error("Simulated offline");
      },
      Date.now() + n * 100000,
    );
  assert.equal(
    store.db.prepare("SELECT attempts FROM outbox").get().attempts,
    5,
  );
  assert.ok(store.db.prepare("SELECT * FROM orders WHERE id=?").get(order.id));
  store.db.close();
});
test("protección de origen rechaza mutaciones externas", async (t) => {
  const { url } = await fixture(t);
  const r = await fetch(`${url}/api/cart`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Zona-Request": "1",
      Origin: "https://otro-sitio.invalid",
    },
    body: JSON.stringify({ cart: [] }),
  });
  assert.equal(r.status, 403);
});
