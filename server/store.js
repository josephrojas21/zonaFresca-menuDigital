import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
export function createStore(file) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, cart TEXT NOT NULL DEFAULT '[]', profile TEXT, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, idem TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(session_id,idem));
 CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0);`);
  return {
    db,
    session(id) {
      return db
        .prepare("SELECT * FROM sessions WHERE id=? AND expires>?")
        .get(id, Date.now());
    },
    createSession(id) {
      db.prepare("INSERT INTO sessions(id,expires) VALUES (?,?)").run(
        id,
        Date.now() + 30 * 86400000,
      );
      return this.session(id);
    },
    cart(id, cart) {
      db.prepare("UPDATE sessions SET cart=? WHERE id=?").run(
        JSON.stringify(cart),
        id,
      );
    },
    profile(id, profile) {
      db.prepare("UPDATE sessions SET profile=? WHERE id=?").run(
        profile ? JSON.stringify(profile) : null,
        id,
      );
    },
    existing(sid, key) {
      const row = db
        .prepare("SELECT * FROM orders WHERE session_id=? AND idem=?")
        .get(sid, key);
      return row ? { ...row, data: JSON.parse(row.data) } : null;
    },
    createOrder: db.transaction((sid, key, fingerprint, data, remember) => {
      const id = randomUUID(),
        order = {
          ...data,
          id,
          createdAt: new Date().toISOString(),
          status: "received_demo",
          paymentStatus: "pending_collection",
          notificationStatus: "pending_demo",
          demo: true,
        };
      db.prepare("INSERT INTO orders VALUES (?,?,?,?,?)").run(
        id,
        sid,
        key,
        fingerprint,
        JSON.stringify(order),
      );
      db.prepare("INSERT INTO outbox(id,order_id) VALUES (?,?)").run(
        randomUUID(),
        id,
      );
      db.prepare("UPDATE sessions SET cart='[]', profile=? WHERE id=?").run(
        remember ? JSON.stringify(data.customer) : null,
        sid,
      );
      return order;
    }),
  };
}
// Demo worker: never calls n8n. A failed send leaves the order intact, retries are bounded.
export function processOutbox(
  store,
  send = () => ({ simulated: true }),
  now = Date.now(),
) {
  const rows = store.db
    .prepare(
      "SELECT * FROM outbox WHERE status='pending' AND next_attempt<=? AND attempts<5",
    )
    .all(now);
  for (const row of rows) {
    try {
      const result = send(row);
      if (result?.then) throw Error("Use a synchronous demo notifier");
      store.db
        .prepare(
          "UPDATE outbox SET status='simulated',attempts=attempts+1 WHERE id=?",
        )
        .run(row.id);
    } catch {
      store.db
        .prepare(
          "UPDATE outbox SET attempts=attempts+1,next_attempt=? WHERE id=?",
        )
        .run(now + 1000 * 2 ** row.attempts, row.id);
    }
  }
}
