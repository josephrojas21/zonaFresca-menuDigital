// Administrative, explicit CLI operation. Never imported by the deployed application.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});
const sql=readFileSync(new URL('../neon/001_web_schema.sql',import.meta.url),'utf8');
const role='zona_fresca_web_app';
await c.connect();
try{
 const {rows}=await c.query("SELECT name FROM public.clients WHERE id='3a3ef7b9-1708-4468-9077-f6bcb285e564'");
 if(rows.length!==1||!rows[0].name.includes('Zona Fresca'))throw Error('La base no corresponde al cliente esperado.');
 await c.query('BEGIN');
 const exist=await c.query("SELECT 1 FROM pg_namespace WHERE nspname='zona_fresca_web'");
 if(exist.rowCount)throw Error('El esquema ya existe: no se vuelve a aprovisionar ni rotar su clave.');
 // Validate all DDL in a rollback-only transaction before applying it.
 await c.query(sql);await c.query('ROLLBACK');
 await c.query('BEGIN');await c.query(sql);
 await c.query(sql.replaceAll('zona_fresca_web','zona_fresca_web_qa'));
 const password=randomBytes(36).toString('hex');
 const quoted=(await c.query('SELECT quote_literal($1) AS value',[password])).rows[0].value;
 await c.query(`CREATE ROLE ${role} LOGIN PASSWORD ${quoted} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
 await c.query(`GRANT USAGE ON SCHEMA zona_fresca_web TO ${role}; GRANT SELECT ON zona_fresca_web.catalog TO ${role}; GRANT SELECT,INSERT,UPDATE,DELETE ON zona_fresca_web.sessions,zona_fresca_web.orders,zona_fresca_web.outbox TO ${role}`);
 await c.query(`GRANT USAGE ON SCHEMA zona_fresca_web_qa TO ${role}; GRANT SELECT ON zona_fresca_web_qa.catalog TO ${role}; GRANT SELECT,INSERT,UPDATE,DELETE ON zona_fresca_web_qa.sessions,zona_fresca_web_qa.orders,zona_fresca_web_qa.outbox TO ${role}`);
 const permissions=(await c.query(`SELECT has_table_privilege('${role}','public.orders','SELECT') AS orders_read,has_table_privilege('${role}','public.orders','INSERT') AS orders_write,has_table_privilege('${role}','public.menu_items','SELECT') AS all_catalog_read`)).rows[0];
 if(Object.values(permissions).some(Boolean))throw Error('El rol tiene permisos no esperados sobre las tablas operativas.');
 await c.query('COMMIT');
 const url=new URL(process.env.ADMIN_DATABASE_URL);url.username=role;url.password=password;url.searchParams.set('sslmode','verify-full');
 // Ignored, restrictive local file; never log credentials.
 writeFileSync('.env.neon.local',`DATABASE_URL=${url.toString()}\n`,{mode:0o600});
 console.log(JSON.stringify({schema:'zona_fresca_web',role,permissions,migration:'applied',credentialFile:'.env.neon.local'}));
}catch(e){await c.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{await c.end();}
