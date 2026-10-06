-- Additive migration; no changes to operational Britech tables/triggers.
-- This schema is exclusive to Zona Fresca. Fixed tenant CHECK prevents tenant injection.
CREATE SCHEMA zona_fresca_web;
CREATE TABLE zona_fresca_web.sessions (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
 client_id uuid NOT NULL CHECK(client_id='3a3ef7b9-1708-4468-9077-f6bcb285e564'),
 cart jsonb NOT NULL DEFAULT '[]', profile jsonb, expires timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,client_id)
);
CREATE TABLE zona_fresca_web.orders (
 id uuid PRIMARY KEY, client_id uuid NOT NULL CHECK(client_id='3a3ef7b9-1708-4468-9077-f6bcb285e564'),
 session_id text NOT NULL, idem uuid NOT NULL, fingerprint text NOT NULL, data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,client_id) REFERENCES zona_fresca_web.sessions(id,client_id),
 UNIQUE(session_id,idem), UNIQUE(id,client_id)
);
CREATE TABLE zona_fresca_web.outbox (
 id uuid PRIMARY KEY, client_id uuid NOT NULL CHECK(client_id='3a3ef7b9-1708-4468-9077-f6bcb285e564'),
 order_id uuid NOT NULL, status text NOT NULL DEFAULT 'disabled_demo' CHECK(status IN ('disabled_demo','pending','sent','failed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(order_id,client_id) REFERENCES zona_fresca_web.orders(id,client_id), UNIQUE(order_id)
);
CREATE INDEX sessions_expiry ON zona_fresca_web.sessions(expires);
CREATE VIEW zona_fresca_web.catalog WITH (security_barrier=true) AS
 SELECT id,name,category,description,price,available,unavailable_until
 FROM public.menu_items WHERE client_id='3a3ef7b9-1708-4468-9077-f6bcb285e564';
REVOKE ALL ON SCHEMA zona_fresca_web FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA zona_fresca_web FROM PUBLIC;
