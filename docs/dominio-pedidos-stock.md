# Dominio: Pedidos y Stock

> Objetivo: explicitar el dominio sin tocar UI y sin cambiar comportamiento. Este documento resume el flujo y propone funciones puras reutilizables, basadas en la lógica vigente en `ProductosTable`, `RecepcionForm` y la página principal de pedidos.

## 1) Mapa del dominio (flujo explícito)

```
Pedido (creado)
   ↓
Envío (remito de envío generado)
   ↓
Recepción (parcial o completa)
   ↓
Stock (aplicar cantidades recibidas)
```

### Estados observados (actuales)
- `creado`: pedido armado pero no enviado.
- `processing`: pedido tomado/en proceso por fábrica (no altera cálculos ni recepción, solo asignación).
- `enviado`: existe remito de envío; se habilita recepción.
- `recibido`: recepción parcial registrada.
- `completado`: recepción completa registrada.

> Nota: aunque `updatePedidoEstado` opera sobre `creado | enviado | recibido | completado`, el estado `processing` aparece en el flujo real de fábrica y debe incluirse en el modelo para no perder fidelidad.

## 2) Modelo de datos (tipos estrictos)

### `PedidoEstado`
```ts
type PedidoEstado = "creado" | "processing" | "enviado" | "recibido" | "completado"
```

### `ProductoPedido` (base para cálculo de pedido)
```ts
type ProductoPedido = {
  productoId: string
  nombre: string
  stockMinimo: number
  unidad?: string
}
```

### `ProductoRecepcion` (resultado consolidado de recepción)
```ts
type ProductoRecepcion = {
  productoId: string
  productoNombre: string
  cantidadEnviada: number
  cantidadRecibida: number
  estado: "ok" // hoy siempre "ok"
  esDevolucion: boolean
  cantidadDevolucion?: number
  observaciones?: string
}
```

### `ProductoEnvio` (insumo de recepción)
```ts
type ProductoEnvio = {
  productoId: string
  productoNombre: string
  cantidadPedida: number
  cantidadEnviada: number
  observacionesEnvio?: string
}
```

## 3) Funciones de dominio (puras)

### 3.1 Calcular cantidades a pedir

**Responsabilidad:** aplicar la regla actual de cálculo (`max(0, stockMinimo - stockActual)`) y luego el ajuste manual (si existe), sin efectos secundarios.

```ts
type AjustesPedido = Record<string, number>

function calcularCantidadPedida(stockMinimo: number, stockActual?: number): number
// Entrada: stockMinimo, stockActual (undefined se trata como 0)
// Salida: cantidad base a pedir (>= 0)

function aplicarAjusteCantidad(cantidadBase: number, ajuste?: number): number
// Entrada: cantidad base, ajuste (puede ser negativo/positivo)
// Salida: cantidad final (>= 0)

function calcularPedidoPorProducto(
  producto: ProductoPedido,
  stockActual: Record<string, number>,
  ajustes?: AjustesPedido
): number
// Entrada: producto, stockActual por productoId, ajustes opcionales
// Salida: cantidad final a pedir por producto (>= 0)
```

### 3.2 Validar recepción

**Responsabilidad:** garantizar que una devolución obligue comentario, y que no se permita marcar devolución si no hay faltante (`recibido >= enviado`).

```ts
type RecepcionInput = {
  productoId: string
  cantidadRecibida: number
  esDevolucion?: boolean
  observaciones?: string
}

type RecepcionValidationError = {
  productoId: string
  mensaje: string
}

function validarRecepcion(
  productosEnviados: ProductoEnvio[],
  recepcion: Record<string, RecepcionInput>
): { ok: true } | { ok: false; errores: RecepcionValidationError[] }
// Regla actual:
// - Si esDevolucion = true → observaciones obligatorias (no vacío).
// - esDevolucion solo se permite si cantidadRecibida < cantidadEnviada.
```

### 3.3 Calcular devoluciones

**Responsabilidad:** calcular cantidad a devolver cuando `esDevolucion` es true; solo faltantes. Si recibido >= enviado → 0.

```ts
function calcularCantidadDevolucion(
  cantidadEnviada: number,
  cantidadRecibida: number,
  esDevolucion: boolean
): number
// Regla actual:
// - Si esDevolucion = false → 0
// - Si cantidadRecibida < cantidadEnviada → devolver faltante (enviada - recibida)
// - Si cantidadRecibida >= cantidadEnviada → 0
```

### 3.4 Aplicar recepción a stock

**Responsabilidad:** sumar cantidades recibidas al stock actual sin efectos secundarios.

```ts
function aplicarRecepcionAStock(
  stockActual: Record<string, number>,
  productos: Array<Pick<ProductoRecepcion, "productoId" | "cantidadRecibida">>
): Record<string, number>
// Regla actual:
// - Solo sumar si cantidadRecibida > 0
// - stockActual inexistente se considera 0
```

### 3.5 Transicionar estado del pedido

**Responsabilidad:** modelar transiciones coherentes con el flujo actual, incluyendo fechas.

```ts
type PedidoTransitionEvent =
  | { type: "GENERAR_ENVIO"; fechaEnvio: Date }
  | { type: "REGISTRAR_RECEPCION"; esParcial: boolean; fechaRecepcion: Date }
  | { type: "REINICIAR_ENVIO" }

function transicionarEstadoPedido(
  estadoActual: PedidoEstado,
  evento: PedidoTransitionEvent
): {
  estado: PedidoEstado
  fechaEnvio?: Date | null
  fechaRecepcion?: Date | null
}
```

**Reglas actuales explícitas:**
- `creado` → `enviado` al generar remito de envío.
- `enviado` → `recibido` si la recepción es parcial.
- `enviado` → `completado` si la recepción es completa.
- `recibido` → `completado` cuando se completa la recepción.
- `enviado` → `creado` si se reinicia el envío (limpia remitoEnvioId/fechaEnvio).

## 4) Entradas y salidas clave (sin UI)

### Entradas
- **Pedido**: estado actual, formato de salida, stock mínimo default.
- **Productos**: `stockMinimo`, `unidad` y `stockActual` por producto.
- **Envío**: cantidades enviadas y observaciones del remito.
- **Recepción**: cantidades recibidas, flag de devolución, comentarios.
- **Ajustes**: del usuario sobre cantidades pedidas (no impactan stock).

### Salidas
- **Cantidad a pedir por producto** (base + ajuste).
- **Recepción consolidada** con devoluciones y comentarios obligatorios.
- **Stock actualizado** sumando cantidades recibidas.
- **Estado del pedido** actualizado según el evento.

## 5) Alcance (no cambios funcionales)
- No agrega features.
- No altera UI.
- Solo organiza el dominio en funciones puras y tipos estrictos para reutilizar en hooks/componentes.
