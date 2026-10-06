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

No se verificaron Neon, n8n, inventario real, cobertura, conciliación bancaria ni entrega física. No se enviaron mensajes ni crearon pedidos reales. Las pruebas de notificaciones solo simulan éxito/fallo; el worker de producción permanece pendiente.
