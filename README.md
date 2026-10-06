# Zona Fresca · Menú digital

Aplicación React + Vite con servidor Express, PostgreSQL/Neon en Vercel y SQLite opcional para desarrollo sin conexión, exclusivamente para Zona Fresca. Modo demostración explícito: ningún pedido se envía al local. El visitante no necesita crear una cuenta.

Publicado en [zonafresca-menudigital.vercel.app](https://zonafresca-menudigital.vercel.app). Comparte la base Neon de Britech, con tablas web separadas y acceso restringido al catálogo de Zona Fresca.

## Ejecutar

Requiere Node.js 22 LTS y npm.

```sh
npm ci
npm run dev
```

Abre http://localhost:3007. El servidor sirve React y `/api` en el mismo origen. `npm test` ejecuta las pruebas aisladas y `npm run build` genera el frontend de producción.

## Qué funciona

- Catálogo estructurado, categorías, búsqueda sin tildes y aliases banana/bananas; arepa presenta sus variedades.
- Precio, ingredientes, disponibilidad y fotografías de referencia extraídas de la carta del usuario. Se reemplazan en `public/images/` y `server/catalog.js`.
- Bolas por sabor, adiciones y exclusiones. Retirar ingredientes no reduce el precio. Grupos de unidades pueden personalizarse de forma distinta mediante líneas independientes.
- Carrito persistente en servidor. Cookie aleatoria opaca HttpOnly / SameSite=Lax, Secure en producción. Expira a los 30 días. No se usan localStorage, fingerprinting ni identificación por teléfono.
- Checkout invitado; comprador, destinatario y teléfono separados; recogida sin dirección y entrega con dirección.
- Recordar datos solo con consentimiento al confirmar; opción para olvidarlos. Los datos de pedidos ya guardados no se borran al olvidar el perfil del dispositivo.
- Cotización y cálculo determinístico en servidor; si cambia el resumen, requiere revisar y confirmar de nuevo.
- Pedidos de prueba con pago en efectivo pendiente de cobro, idempotencia por sesión y transacción SQLite que guarda pedido + outbox y vacía carrito. Envíos a distintas direcciones se realizan como pedidos consecutivos independientes.
- Outbox con función de pruebas de fallo y reintentos limitados; no se ejecuta automáticamente ni realiza llamadas externas.

## Integración activa con Britech

El despliegue consulta precios base, disponibilidad y precios de adiciones desde una vista de `public.menu_items` filtrada al cliente Zona Fresca (`3a3ef7b9-1708-4468-9077-f6bcb285e564`). La base es `neondb` de Britech, sin crear otro proyecto Neon. Se mantienen 38 fichas web; las entradas sin correspondencia se deshabilitan y no se usa un precio antiguo como respaldo. Productos adicionales existentes en Britech requieren sus fichas/reglas web antes de publicarlos.

Las sesiones, carritos, pedidos de demostración y outbox se guardan en `zona_fresca_web`. Las previews y pruebas usan `zona_fresca_web_qa`. El rol `zona_fresca_web_app` tiene permisos directos únicamente sobre estas tablas y la vista del catálogo; no puede leer ni escribir directamente las tablas operativas globales. Las tablas incluyen restricciones fijas de cliente y relaciones que impiden asociar datos a otro cliente. El catálogo no es editable desde este menú.

Las imágenes son recortes de la carta del usuario, referencias por categoría. Los sabores y parte de las reglas de personalización siguen siendo fixtures. El litro ahora toma su precio de Neon y permite un solo sabor. La bola adicional y las adiciones toman precios de Neon; por ejemplo, cereal en la base es $2.000, distinto al PDF.

El domicilio sigue usando **$5.000 simulados**. No confirma cobertura real. Transferencia permanece deshabilitada. Los pedidos tienen estado `received_demo` y los eventos `disabled_demo`: no se insertan en `public.orders`, que tiene un trigger operativo, y no se envían a n8n. Publicar la web no activa ventas reales.

## Arquitectura y contratos

- `server/catalog.js`: adaptador de catálogo y fixtures con IDs estables, ingredientes, límites y aliases.
- `server/pricing.js`: validación estricta de líneas, cálculo entero COP, adaptador de entrega y huella del resumen.
- `server/store.js`: adaptador de sesiones/pedidos y outbox transaccional; demostración de reintentos sin conexión externa.
- `server/app.js`: API de mismo origen. El navegador nunca recibe credenciales.
- `src/`: React y estilos adaptables, diálogos nativos con foco, teclado, estados de carga/error.

API local propia de esta aplicación (no endpoints existentes de Britech):

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/bootstrap` | Catálogo, carrito y perfil de la sesión actual |
| PUT | `/api/cart` | Validar y guardar líneas |
| POST | `/api/quote` | Recalcular carrito + método/dirección |
| POST | `/api/orders` | Validar resumen e idempotencia y crear prueba |
| DELETE | `/api/profile` | Olvidar perfil del dispositivo |

Mutaciones requieren encabezado `X-Zona-Request: 1`; se valida Origin. Cuerpo máximo 48 KB. Las líneas tienen UUID; precios enviados por cliente se rechazan. El token de cotización no autoriza un total: el servidor vuelve a calcularlo.

## Pendientes para ventas reales

1. Validar sabores, cantidades, reglas web, cobertura, tarifa real y dirección de recogida con el negocio.
2. Acordar el contrato autenticado de eventos con n8n y la incorporación de pedidos web a `public.orders`, preservando comprador/destinatario, idempotencia, pagos y notificaciones existentes. No se modificaron workflows ni triggers.
3. Implementar el worker operativo con reintentos y deduplicación, estados independientes de recibido/notificado/aceptado/en preparación/pago confirmado.
4. Habilitar transferencias solo con instrucciones verificadas y conciliación autorizada.
5. Aplicar retención, limpieza programada de sesiones vencidas, controles de abuso y monitoreo para ventas reales. La recuperación entre dispositivos requiere verificación opcional futura.

## Vercel

`vercel.json` sirve Vite desde `dist` y dirige `/api/*` a `api/index.js`. Esta función reutiliza Express y un pool PostgreSQL registrado con `attachDatabasePool`. Las transacciones bloquean la sesión al confirmar y guardan pedido + evento + limpieza del carrito en un único commit. No se usa disco local en Vercel.

Variables del servidor:

- `DATABASE_URL`: conexión del rol restringido; variable **sensible**, nunca `VITE_*`. Configurada para production y preview.
- `APP_ORIGIN`: opcional si se quiere restringir a un dominio específico; por defecto se compara Origin contra el host de la solicitud HTTPS detrás del proxy de Vercel.
- `VERCEL_ENV`: definida por Vercel; preview selecciona el esquema QA y production el esquema web.

Despliegue desde la carpeta del proyecto:

```sh
npm ci
npm test
npm run build
npx vercel deploy --scope joseph2113s-projects
# Tras verificar la preview:
npx vercel deploy --prod --scope joseph2113s-projects
```

La conexión GitHub automática debe autorizarse en Vercel si el proveedor Git rechaza el enlace. Los despliegues CLI funcionan de forma independiente.

Para usar Neon localmente (la credencial debe existir en un archivo ignorado con permisos 600):

```sh
node --env-file=.env.neon.local server/index.js
node --env-file=.env.neon.local --test tests/neon.integration.js
```

La segunda instrucción solo escribe datos sintéticos en el esquema QA y limpia sus propias filas al terminar. La migración aditiva está en `neon/001_web_schema.sql`; `scripts/provision-neon.mjs` es una operación administrativa de una sola vez, no se ejecuta al arrancar ni durante el build. No pasar la credencial de administrador al despliegue.

## Reversión

Revertir al despliegue anterior con Vercel para cambios futuros, o pausar este proyecto si es el primer despliegue. No borrar las tablas nuevas como parte de un rollback de código. El catálogo operativo, otros clientes y workflows permanecen intactos. La base local anterior sigue disponible para desarrollo; no desplegar SQLite en Vercel.
