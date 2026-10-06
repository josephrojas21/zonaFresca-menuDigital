import express from "express";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { catalogAdapter } from "./catalog.js";
import { cartSchema, calculate, quote } from "./pricing.js";
const customerSchema = z
  .object({
    buyer: z.string().trim().min(2, "Escribe tu nombre.").max(80),
    recipient: z.string().trim().min(2, "Escribe el destinatario.").max(80),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d ()-]{7,20}$/, "Revisa el teléfono de contacto."),
    address: z.string().trim().max(200).default(""),
    instructions: z.string().trim().max(300).default(""),
  })
  .strict();
const deliverySchema = z.enum(["pickup", "delivery"]);
export function createApp(
  store,
  { secure = false, origin, catalogSource } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "48kb" }));
  app.use("/api", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      (req.get("X-Zona-Request") !== "1" ||
        (req.get("origin") &&
          req.get("origin") !==
            (origin || `${req.protocol}://${req.get("host")}`)))
    )
      return res
        .status(403)
        .json({ error: "Origen de solicitud no permitido." });
    let sid = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("zf_session="))
      ?.slice(11);
    let session = /^[a-f0-9]{64}$/.test(sid || "")
      ? await store.session(sid)
      : null;
    if (!session) {
      sid = randomBytes(32).toString("hex");
      session = await store.createSession(sid);
      res.cookie("zf_session", sid, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        maxAge: 30 * 86400000,
        path: "/",
      });
    }
    req.sid = sid;
    req.session = session;
    next();
  });
  const readCatalog =
    catalogSource ||
    (() => (store.catalog ? store.catalog() : catalogAdapter.get()));
  app.get("/api/bootstrap", async (req, res) => {
    const catalog = await readCatalog();
    const cart = JSON.parse(req.session.cart);
    let priced = null,
      cartError = null;
    try {
      priced = calculate(cart, catalog.products, catalog.additions);
    } catch (e) {
      cartError = e.message;
    }
    res.json({
      catalog,
      cart,
      priced,
      cartError,
      profile: req.session.profile ? JSON.parse(req.session.profile) : null,
    });
  });
  app.put("/api/cart", async (req, res) => {
    const cart = cartSchema.parse(req.body.cart);
    const catalog = await readCatalog();
    const priced = calculate(cart, catalog.products, catalog.additions);
    await store.withSessionLock(req.sid, (locked) =>
      locked.cart(req.sid, cart),
    );
    res.json({ cart, priced });
  });
  app.delete("/api/profile", async (req, res) => {
    await store.withSessionLock(req.sid, (locked) =>
      locked.profile(req.sid, null),
    );
    res.json({ ok: true });
  });
  app.post("/api/quote", async (req, res) => {
    const method = deliverySchema.parse(req.body.method);
    const address = z
      .string()
      .max(200)
      .parse(req.body.address || "");
    const catalog = await readCatalog();
    res.json(
      quote(
        JSON.parse((await store.session(req.sid)).cart),
        method,
        address,
        catalog.products,
        catalog.additions,
      ),
    );
  });
  app.post("/api/orders", async (req, res) => {
    const input = z
      .object({
        key: z.string().uuid(),
        quoteToken: z.string().length(64),
        method: deliverySchema,
        customer: customerSchema,
        remember: z.boolean(),
        payment: z.literal("cash"),
        cash: z.union([
          z.literal("exact"),
          z.number().int().nonnegative().max(100000000),
        ]),
      })
      .strict()
      .parse(req.body);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    await store
      .withSessionLock(req.sid, async (lockedStore) => {
        const existing = await lockedStore.existing(req.sid, input.key);
        if (existing) {
          if (existing.fingerprint !== fingerprint)
            return res
              .status(409)
              .json({ error: "Esta confirmación ya se usó con otros datos." });
          return res.json(existing.data);
        }
        if (input.method === "delivery" && input.customer.address.length < 8)
          return res.status(400).json({
            error: "Escribe una dirección completa para el domicilio.",
          });
        const cart = JSON.parse((await lockedStore.session(req.sid)).cart);
        if (!cart.length)
          return res
            .status(400)
            .json({ error: "Agrega productos antes de confirmar." });
        const catalog = catalogSource
          ? await catalogSource()
          : lockedStore.catalog
            ? await lockedStore.catalog()
            : catalogAdapter.get();
        const latest = quote(
          cart,
          input.method,
          input.customer.address,
          catalog.products,
          catalog.additions,
        );
        if (latest.token !== input.quoteToken)
          return res.status(409).json({
            error: "El resumen cambió. Revisa y acepta los nuevos valores.",
            quote: latest,
          });
        if (latest.total === null)
          return res
            .status(400)
            .json({ error: "Falta calcular el domicilio." });
        if (input.cash !== "exact" && input.cash < latest.total)
          return res
            .status(400)
            .json({ error: "El efectivo debe cubrir el total." });
        const customer = {
          ...input.customer,
          ...(input.method === "pickup"
            ? { address: "", instructions: "" }
            : {}),
        };
        const order = await lockedStore.createOrder(
          req.sid,
          input.key,
          fingerprint,
          {
            ...latest,
            customer,
            method: input.method,
            payment: "cash",
            cash: input.cash,
          },
          input.remember,
        );
        return order;
      })
      .then((order) => {
        if (!res.headersSent) res.status(201).json(order);
      });
  });
  app.use("/api", (err, req, res, next) => {
    if (err.code || err.message?.includes("connect")) {
      console.error("Database operation failed", err.code || "connection");
      return res.status(503).json({
        error:
          "El servicio no está disponible temporalmente. Intenta de nuevo.",
      });
    }
    res.status(400).json({
      error:
        err instanceof z.ZodError
          ? err.issues.map((i) => i.message).join(" ")
          : err.message || "No se pudo completar la solicitud.",
    });
  });
  return app;
}
