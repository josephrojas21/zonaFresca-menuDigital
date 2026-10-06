import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import express from "express";
import { createApp } from "./app.js";
import { createStore } from "./store.js";
const file = process.env.DATABASE_FILE || ".data/zona-fresca.sqlite";
mkdirSync(dirname(resolve(file)), { recursive: true });
const production = process.env.NODE_ENV === "production";
if (production && !process.env.APP_ORIGIN)
  throw Error("APP_ORIGIN (HTTPS) es obligatorio en producción.");
const app = createApp(createStore(file), {
  secure: production,
  origin: process.env.APP_ORIGIN,
});
if (production) {
  app.use(express.static("dist"));
  app.get("/{*path}", (req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3007);
app.listen(port, "127.0.0.1", () =>
  console.log(`Zona Fresca · demo local: http://localhost:${port}`),
);
