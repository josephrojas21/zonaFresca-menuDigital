import { products, additions, flavors } from "./catalog.js";
const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const additionNames = {
  queso: "Adición Queso",
  fruta: "Agregar fruta",
  "porcion-fruta": "Porción de fruta",
  cereal: "Adición Cereal",
  proteina: "Proteína en arepa",
};
export function mapCatalog(rows) {
  const byName = new Map(rows.map((r) => [normalize(r.name), r]));
  const available = (row) =>
    !!row &&
    (row.available ||
      (row.unavailable_until &&
        new Date(row.unavailable_until).getTime() <= Date.now()));
  const extraBall = byName.get(normalize("Adición bola de helado"));
  const liveAdditions = additions.flatMap((a) => {
    const r = byName.get(normalize(additionNames[a.id]));
    return available(r)
      ? [{ ...a, price: Number(r.price), source: "Britech / Neon" }]
      : [];
  });
  const mapped = products.map((p) => {
    const r = byName.get(normalize(p.name));
    const result = {
      ...p,
      price: r ? Number(r.price) : null,
      available: available(r),
      catalogItemId: r?.id || null,
      description: r?.description || p.description,
      ingredients: r?.description || p.ingredients,
      additions: p.additions.filter((id) =>
        liveAdditions.some((a) => a.id === id),
      ),
      extraScoopPrice: available(extraBall) ? Number(extraBall.price) : 0,
      maxScoops: available(extraBall) ? p.maxScoops : p.includedScoops,
      source: "Britech / Neon",
    };
    if (p.id === "litro")
      Object.assign(result, { includedScoops: 0, maxScoops: 0, maxFlavors: 1 });
    return result;
  });
  return {
    products: mapped,
    additions: liveAdditions,
    flavors,
    demo: true,
    source: "neon",
    notice:
      "Precios y disponibilidad conectados al catálogo de Britech. Compra en demostración; sabores y reglas web pendientes de validación. No se envían pedidos al local.",
  };
}
