# Verificación — 6 de octubre de 2026

## Automatizada

`npm test`: 18 pruebas aprobadas. Se usan bases SQLite en memoria y datos sintéticos.

Cubren cálculo 4/5 bolas y sabor repetido, personalizaciones independientes de seis bananas, eliminación sin descuentos, validación estricta, agotados, litro con un sabor, bolas de malteadas/café/batido, familias de arepa, subtotal sin dirección, cambio de precios, restauración de carrito, aislamiento de sesiones, consentimiento/olvido, doble clic idempotente, dos direcciones, efectivo insuficiente, transferencia deshabilitada, cambios antes de confirmar, outbox ante fallo y protección de origen.

`npm run build`: compilación Vite correcta.
`npm install`: auditoría reportó 0 vulnerabilidades.

## Navegador

- Revisión de escritorio y móvil (390 px), sin desbordamiento horizontal.
- Categoría Copas muestra sus seis productos.
- Copa de cuatro bolas de vainilla: $24.000; quinta bola: $28.000 en fixture.
- Agregar, recargar y abrir carrito: conserva 5 bolas de vainilla y subtotal $28.000.
- Checkout de recogida: comprador, destinatario y teléfono; sin dirección.
- Pedido sintético confirmado, estado recibido de demostración y pago pendiente de cobro; se comunica explícitamente que no se envió al local.
- Búsqueda “bananas” devuelve Banana split.
- Consola revisada sin errores ni advertencias.

La automatización inicial agent-browser permitió revisar renderizado, pero sus clics no cambiaron el estado de esta sesión del navegador integrado. Las interacciones se verificaron con los controles nativos de Codex (CUA/Playwright).

## Límites

En la verificación inicial no se verificó Neon; la integración posterior se documenta abajo. Siguen pendientes n8n, inventario real, cobertura, conciliación bancaria y entrega física. No se enviaron mensajes ni crearon pedidos reales. Las pruebas de notificaciones solo simulan éxito/fallo; el worker de producción permanece pendiente.

## Integración Neon y Vercel — 6 de octubre de 2026

- Migración de tablas nuevas ensayada primero en una transacción con rollback y luego aplicada. Sin cambios a tablas operativas ni workflows.
- Rol de aplicación sin permisos directos a `public.orders`, `public.clients`, `public.conversations` ni `public.menu_items`. La vista permite únicamente el catálogo de Zona Fresca.
- 18 pruebas originales aprobadas después de convertir el backend a operaciones asíncronas.
- Suite Neon: 9 escenarios (10 tests contando el contenedor) aprobados usando el rol restringido y el esquema QA. Incluyen persistencia entre pools, aislamiento, CHECK de tenant, rollback después de insertar pedido, concurrencia de dos confirmaciones, idempotencia, consentimiento/olvido y cambios de precio.
- Los datos sintéticos creados por la suite se eliminan por sus IDs al terminar. No se escriben pedidos operativos ni se envían mensajes.
- Compilación Vite correcta; variables locales de Neon y configuración de Vercel verificadas como ignoradas por Git.

## Despliegue público verificado

- URL: https://zonafresca-menudigital.vercel.app
- Despliegue Vercel READY: `dpl_2kByw87d59re1FuEwnXwwhPMwt3i`, código `436222e`, equipo `joseph2113s-projects`.
- Página y `/api/bootstrap`: HTTP 200 sin autenticación de Vercel. Catálogo con fuente `neon` y 38 productos; cookie de sesión Secure y HttpOnly.
- Navegador publicado: litro a $30.000, selección única de Fresa, carrito conservado al recargar, checkout de recogida y carrito vacío después de confirmar.
- Pedido sintético `d3733202-4745-4809-b70e-a2c1a666038d` comprobado en las tablas web: `received_demo`, demo activo, outbox `disabled_demo`. Sin inserciones en `public.orders` ni notificaciones.
- Consola del navegador sin errores ni advertencias. Captura: `docs/hosted-preview.png`.
- Publicación realizada mediante CLI. La vinculación automática con GitHub falló por acceso; requiere autorizar el repositorio en Vercel para desplegar por push.
