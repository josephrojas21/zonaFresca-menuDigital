import { attachDatabasePool } from '@vercel/functions';
import { createPostgresStore } from '../server/postgres-store.js';
import { createApp } from '../server/app.js';
let app;
export default function handler(req,res){
 if(!app){
  if(!process.env.DATABASE_URL) return res.status(503).json({error:'Falta configurar el almacenamiento del menú.'});
  const store=createPostgresStore(process.env.DATABASE_URL,{schema:process.env.VERCEL_ENV==='preview'?'zona_fresca_web_qa':'zona_fresca_web'});
  attachDatabasePool(store.pool);
  app=createApp(store,{secure:true,origin:process.env.APP_ORIGIN});
  // Vercel terminates TLS; only its proxy forwards requests to this function.
  app.set('trust proxy',1);
 }
 const route=req.query?.route;
 if(typeof route==='string')req.url='/api/'+route;
 return app(req,res);
}
