export async function api(path, body, method = "POST") {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined && method === "POST" ? "GET" : method,
    headers: { "Content-Type": "application/json", "X-Zona-Request": "1" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      result.error || "No se pudo completar. Intenta otra vez.",
    );
    error.quote = result.quote;
    throw error;
  }
  return result;
}
export const money = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
