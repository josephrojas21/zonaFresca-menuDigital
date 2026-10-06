# Zona Fresca · Menú digital

Aplicación React + Vite con servidor Express y SQLite local, exclusivamente para Zona Fresca. Modo demostración explícito: ningún pedido se envía al local. No requiere cuentas ni servicios externos.

## Ejecutar

Requiere Node.js 20.19+ (recomendado Node 22 LTS) y npm.

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

## Fuentes y límites de la demostración

Nombres, precios base y descripciones transcritos de las cuatro páginas de `Carta-ZonaFresca.pdf`. No se confirmó vigencia con un catálogo en producción. Las imágenes son recortes de esa carta, referencias por categoría, no fotografías oficiales de cada producto.

Disponibilidad, sabores, adiciones permitidas y algunas equivalencias sabor/bola son fixtures. Gaseosas se muestra agotado para probar ese estado, no como afirmación de inventario real. Litro no tiene precio en el PDF: no se vende hasta confirmarlo. La regla de un único sabor está implementada y probada.

La bola adicional cuesta **$4.000 en el fixture** y domicilio **$5.000 en el fixture**. Ambos están señalados como valores de prueba. No confirman cobertura real. Antes de dirección solo se muestra subtotal y domicilio por calcular. Transferencia deshabilitada hasta tener instrucciones verificadas. No se inventaron horarios ni tiempos de entrega.

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

## Integraciones pendientes

Se inspeccionó `neon/schema_actual.sql`: `menu_items` separa por `client_id`; `orders` requiere `client_id`, `customer_phone`, campos de entrega y estado. No ofrece la estructura completa de personalizaciones ni outbox/idempotencia requerida. El workflow de Zona Fresca tiene entrada WhatsApp `zonafresca-wa`; no se asumió que fuese una API de pedidos web. No se modificó ningún workflow ni otro cliente.

Antes de activar ventas:

1. Confirmar ID de cliente/sede, catálogo, sabores, cantidades, inventario, precios extra, cobertura, dirección de recogida y forma de pago con el negocio.
2. Implementar adaptadores Neon con aislamiento obligatorio por cliente/sede, transacción pedido/outbox e índices únicos para idempotencia. Diseñar migración aparte; no reemplazar tablas compartidas sin revisión.
3. Definir un contrato autenticado de eventos web con n8n. Implementar worker asíncrono con reintentos, deduplicación por event ID y estados independientes de recibido/notificado/aceptado/en preparación/pago confirmado.
4. Añadir tarifa real y validación de cobertura. Habilitar transferencias solo con instrucciones verificadas y conciliación autorizada.
5. Definir retención y limpieza de sesiones/pedidos, rate limiting, monitoreo y backups. Verificación opcional entre dispositivos queda como integración futura; no se exige registro.
6. Ejecutar QA aislado de extremo a extremo antes de habilitar adaptadores reales.

## Variables y despliegue de la demo

Consulta `.env.example`. No contiene secretos. Configura las variables en el shell o proveedor; el proyecto no carga `.env` automáticamente.

1. En un servidor Node con disco persistente, ejecutar `npm ci && npm test && npm run build`.
2. Montar volumen persistente y establecer `DATABASE_FILE=/ruta/volumen/zona-fresca.sqlite`.
3. Configurar `APP_ORIGIN=https://tu-dominio` y `PORT=3007`.
4. Ejecutar `npm start` detrás de un reverse proxy HTTPS hacia `127.0.0.1:3007`. El servidor escucha en loopback deliberadamente; el proxy debe compartir host/red.
5. Verificar cookie Secure, restauración de carrito, origen autorizado y permisos del archivo SQLite. No publicar esta SQLite local en funciones serverless con disco efímero.
6. Para Vercel u otro serverless: primero sustituir el adaptador SQLite por almacenamiento persistente, implementar transacción y probar; no desplegar este backend sin esa adaptación.

Este repositorio no activa ventas ni publica automáticamente. No hay variables públicas de Neon/n8n. Para reiniciar solamente los datos de prueba, detener el servidor y eliminar `.data/` tras comprobar que no necesitas las pruebas guardadas.
