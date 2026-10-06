import pg from "pg";
import { randomUUID } from "node:crypto";
import { mapCatalog } from "./neon-catalog.js";
export const ZONA_CLIENT_ID = "3a3ef7b9-1708-4468-9077-f6bcb285e564";
export function createPostgresStore(
  connectionString,
  { schema = "zona_fresca_web" } = {},
) {
  if (!/^zona_fresca_web(?:_qa)?$/.test(schema))
    throw Error("Esquema no permitido.");
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
  });
  function adapter(connection) {
    return {
      pool,
      async session(id) {
        const { rows } = await connection.query(
          `SELECT id,cart::text,profile::text,expires FROM ${schema}.sessions WHERE id=$1 AND client_id=$2 AND expires>now()`,
          [id, ZONA_CLIENT_ID],
        );
        return rows[0] || null;
      },
      async createSession(id) {
        await connection.query(
          `INSERT INTO ${schema}.sessions(id,client_id,expires) VALUES($1,$2,now()+interval '30 days')`,
          [id, ZONA_CLIENT_ID],
        );
        return this.session(id);
      },
      async cart(id, cart) {
        await connection.query(
          `UPDATE ${schema}.sessions SET cart=$1::jsonb WHERE id=$2 AND client_id=$3`,
          [JSON.stringify(cart), id, ZONA_CLIENT_ID],
        );
      },
      async profile(id, profile) {
        await connection.query(
          `UPDATE ${schema}.sessions SET profile=$1::jsonb WHERE id=$2 AND client_id=$3`,
          [profile ? JSON.stringify(profile) : null, id, ZONA_CLIENT_ID],
        );
      },
      async existing(sid, key) {
        const { rows } = await connection.query(
          `SELECT fingerprint,data FROM ${schema}.orders WHERE session_id=$1 AND idem=$2 AND client_id=$3`,
          [sid, key, ZONA_CLIENT_ID],
        );
        return rows[0] || null;
      },
      async catalog() {
        return mapCatalog(
          (await connection.query(`SELECT * FROM ${schema}.catalog`)).rows,
        );
      },
      async createOrder(sid, key, fingerprint, data, remember) {
        // Must run inside withSessionLock: order, event and cart clearing commit together.
        if (connection === pool)
          throw Error("Se requiere una transacción de pedido.");
        const id = randomUUID(),
          order = {
            ...data,
            id,
            createdAt: new Date().toISOString(),
            status: "received_demo",
            paymentStatus: "pending_collection",
            notificationStatus: "disabled_demo",
            demo: true,
          };
        await connection.query(
          `INSERT INTO ${schema}.orders(id,client_id,session_id,idem,fingerprint,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
          [id, ZONA_CLIENT_ID, sid, key, fingerprint, JSON.stringify(order)],
        );
        await connection.query(
          `INSERT INTO ${schema}.outbox(id,client_id,order_id,status) VALUES($1,$2,$3,'disabled_demo')`,
          [randomUUID(), ZONA_CLIENT_ID, id],
        );
        await this.cart(sid, []);
        await this.profile(sid, remember ? data.customer : null);
        return order;
      },
      async withSessionLock(id, fn) {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const result = await c.query(
            `SELECT id FROM ${schema}.sessions WHERE id=$1 AND client_id=$2 AND expires>now() FOR UPDATE`,
            [id, ZONA_CLIENT_ID],
          );
          if (!result.rowCount)
            throw Error("La sesión venció. Recarga la página.");
          const value = await fn(adapter(c));
          await c.query("COMMIT");
          return value;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
    };
  }
  return adapter(pool);
}
