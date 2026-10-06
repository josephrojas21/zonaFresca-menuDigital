import { z } from "zod";
import { createHash } from "node:crypto";
import { products, additions } from "./catalog.js";
export const lineSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string(),
    quantity: z.number().int().min(1).max(30),
    flavors: z.record(z.number().int().min(0).max(12)).default({}),
    additions: z.array(z.string()).max(10).default([]),
    removals: z.array(z.string()).max(10).default([]),
    variant: z.string().max(50).default(""),
    note: z.string().trim().max(300).default(""),
  })
  .strict();
export const cartSchema = z.array(lineSchema).max(60);
export function calculate(raw, catalog = products) {
  const cart = cartSchema.parse(raw);
  if (new Set(cart.map((l) => l.id)).size !== cart.length)
    throw Error("Cada línea debe tener un identificador único.");
  const lines = cart.map((line) => {
    const p = catalog.find((p) => p.id === line.productId);
    if (!p || !p.available || !Number.isInteger(p.price))
      throw Error(
        `${p?.name || "Producto"} no está disponible. Retíralo del carrito.`,
      );
    for (const [flavor, n] of Object.entries(line.flavors))
      if (!p.flavors.includes(flavor) || !Number.isInteger(n))
        throw Error("Sabor no permitido.");
    const scoops = Object.values(line.flavors).reduce((s, n) => s + n, 0);
    const noIce = line.removals.includes("helado");
    if (p.id === "litro") {
      if (
        Object.values(line.flavors).filter((n) => n > 0).length !== 1 ||
        scoops !== 1
      )
        throw Error("El litro permite un solo sabor.");
    } else if (
      noIce ? scoops !== 0 : scoops < p.includedScoops || scoops > p.maxScoops
    )
      throw Error(
        `Selecciona ${p.includedScoops} bolas incluidas; máximo ${p.maxScoops}.`,
      );
    if (Object.values(line.flavors).filter((n) => n > 0).length > p.maxFlavors)
      throw Error("Demasiados sabores.");
    if (
      new Set(line.additions).size !== line.additions.length ||
      line.additions.some((a) => !p.additions.includes(a))
    )
      throw Error("Adición no permitida.");
    if (
      new Set(line.removals).size !== line.removals.length ||
      line.removals.some((a) => !p.removals.includes(a))
    )
      throw Error("Personalización no permitida.");
    if (
      p.variants.length
        ? !p.variants.includes(line.variant)
        : line.variant !== ""
    )
      throw Error("Escoge una variedad válida.");
    const extras =
      line.additions.reduce(
        (s, id) => s + additions.find((a) => a.id === id).price,
        0,
      ) +
      (p.id === "litro" ? 0 : Math.max(0, scoops - p.includedScoops)) *
        p.extraScoopPrice;
    return {
      ...line,
      name: p.name,
      base: p.price,
      extras,
      unitPrice: p.price + extras,
      total: (p.price + extras) * line.quantity,
    };
  });
  const base = lines.reduce((s, l) => s + l.base * l.quantity, 0),
    extras = lines.reduce((s, l) => s + l.extras * l.quantity, 0);
  return {
    lines,
    base,
    extras,
    subtotal: base + extras,
    count: lines.reduce((s, l) => s + l.quantity, 0),
  };
}
export const deliveryAdapter = {
  quote(method, address) {
    if (method === "pickup")
      return { fee: 0, label: "Recogida en el local", demo: true };
    if (!address?.trim())
      return { fee: null, label: "Domicilio por calcular", demo: true };
    return {
      fee: 5000,
      label: "Tarifa simulada · no confirma cobertura",
      demo: true,
    };
  },
};
export function quote(
  cart,
  method = "pickup",
  address = "",
  catalog = products,
) {
  if (method === "pickup") address = "";
  const result = calculate(cart, catalog),
    delivery = deliveryAdapter.quote(method, address);
  const total = delivery.fee === null ? null : result.subtotal + delivery.fee;
  const token = createHash("sha256")
    .update(JSON.stringify({ result, delivery, method, address }))
    .digest("hex");
  return { ...result, delivery, total, token };
}
