# Spec: Stock & Pedidos PWA — Nueva experiencia multi-pantalla

**Fecha:** 2026-04-18  
**Ruta base:** `/pwa/[companySlug]/stock-console`

---

## Objetivo

Reemplazar la pantalla única de stock-console por una experiencia de operación diaria con 4 módulos independientes: contar stock, ver/enviar pedido, despachar y recibir. Cada módulo es una subpantalla con su propia ruta Next.js.

---

## Arquitectura

### Rutas creadas / modificadas

| Archivo | Estado |
|---|---|
| `app/pwa/[companySlug]/stock-console/page.tsx` | Reemplazar |
| `app/pwa/[companySlug]/stock-console/stock/page.tsx` | Crear |
| `app/pwa/[companySlug]/stock-console/pedido/page.tsx` | Crear |
| `app/pwa/[companySlug]/stock-console/despacho/page.tsx` | Crear |
| `app/pwa/[companySlug]/stock-console/recepcion/page.tsx` | Crear |

### Principios de arquitectura

- Cada `page.tsx` es **"use client"** y completamente autónomo: llama a sus propios hooks, no depende de estado compartido entre rutas.
- El guard `if (!user) → <LoginForm>` se repite en **cada** page.tsx (no en layout) para cubrir acceso directo por URL.
- No se modifica `PwaShell`, los tabs de navegación, ni ningún hook existente.
- Los componentes UI se crean inline dentro de cada page (no como componentes separados), excepto si hay lógica muy reutilizable que justifique extracción.

---

## Pantalla principal: `/stock-console` (index)

**Archivo:** `app/pwa/[companySlug]/stock-console/page.tsx`  
**Reemplaza:** el render de `<StockConsoleContent />` actual.

### Layout

```
┌─────────────────────────────┐
│  Stock & Pedidos            │
├─────────────────────────────┤
│  Mis tareas                 │
│  [📦] Contar stock       ›  │
│  [📋] Ver y enviar pedido ›  │
├─────────────────────────────┤
│  Fábrica                    │
│  [🏭] Tomar y despachar  ›  │
│  [✅] Recibir pedido     ›  │
└─────────────────────────────┘
```

### Comportamiento

- Navega con `useRouter().push(...)` a cada subruta.
- No llama a hooks de datos (es solo navegación).
- El guard de login se aplica antes del render.

---

## Pantalla 1: Contar stock (`/stock-console/stock`)

**Hook:** `useStockConsole(user)` de `hooks/use-stock-console.ts`

### Datos usados del hook

| Dato | Uso |
|---|---|
| `pedidos[]` | Chips de filtro (grupos) |
| `state.selectedPedidoId` | Chip activo |
| `productos[]` | Lista de ítems |
| `state.cantidades` | Valor mostrado en contadores |
| `stockActual` | Cálculo del estado de stock |
| `state.loading` | Deshabilitar botones |

### Acciones usadas del hook

| Acción | Trigger |
|---|---|
| `setSelectedPedidoId(id)` | Tap en chip |
| `incrementarCantidad(id, 1)` | Botón `+` |
| `decrementarCantidad(id, 1)` | Botón `−` |
| `limpiarCantidades()` | Botón "Limpiar" |
| `confirmarMovimientos()` | Botón "Guardar stock" |

### Estado de stock (badge por producto)

```
stockActual[id] < stockMinimoUnits * 0.5  → "Bajo"   (rojo)
stockActual[id] < stockMinimoUnits         → "Regular" (naranja)
stockActual[id] >= stockMinimoUnits        → "OK"      (verde)
```

Usando `getStockStatus` de `@/lib/stock-status` si existe, o cálculo directo.

### Layout

```
[Header: ‹ Contar stock | chip-grupo]
[Chips: GRUPO1 | GRUPO2 | ...]
[Info: "Ingresá el stock real..."]
[Lista de productos]
  producto.nombre · unidad · mínimo X
  badge-estado  [−] cantidad [+]
[Bottom: Limpiar | Guardar stock]
```

---

## Pantalla 2: Ver y enviar pedido (`/stock-console/pedido`)

**Hook:** `useLogistica(user)` de `hooks/use-logistica.ts`

### Datos usados

| Dato | Uso |
|---|---|
| `pedidosPropios` | Lista de pedidos del día (filtrados por fecha en cliente) |
| `loading` | Spinner inicial |

### Filtro "del día"

Filtrar `pedidosPropios` donde `creadoEn` (Firestore Timestamp) corresponde a la fecha de hoy en el cliente. Si `creadoEn` es null/undefined, excluir el pedido de la lista "de hoy" pero no crashear.

### Flujo de creación de nuevo pedido

Los borradores auto-generados (estado `"borrador"`, `esPendiente: true`) aparecen con sus `items[]` precargados (`cantidadSugerida` como referencia, `cantidadPedida` como valor inicial ajustable).

Al pulsar **"Enviar pedido"**, se llama `crearPedidoFabrica` con:
```ts
{
  origenLocationId: locationId,
  origenNombre: userData.locationName,
  destinoLocationId: pedido.destinoLocationId,
  destinoNombre: pedido.destinoNombre,
  grupoPedidoId: pedido.grupoPedidoId,
  grupoPedidoNombre: pedido.grupoPedidoNombre,
  items: itemsAjustados,  // cantidadPedida ajustada por el usuario
}
```

Esto crea un nuevo pedido en `"enviado"`. El borrador de referencia no se modifica.

### Pedidos ya enviados

Pedidos con `estado !== "borrador"` se muestran como **solo lectura** con badge de estado semántico.

### Layout

```
[Header: ‹ Pedido del día]
[Si no hay pedidos: estado vacío]
[Para cada pedido borrador:]
  Destino · Grupo
  Tabla: Producto | Sugerido | [−] cant [+]
  [Enviar pedido]
[Para cada pedido enviado/despachado:]
  Destino · estado-badge
  Items (solo lectura)
```

---

## Pantalla 3: Tomar y despachar (`/stock-console/despacho`)

**Hook:** `useLogistica(user)`

### Datos usados

| Dato | Uso |
|---|---|
| `pedidosParaMi` | Filtrado a estados activos |

### Filtro de pedidos mostrados

Mostrar solo pedidos con `estado` en: `"enviado"` | `"en_preparacion"` | `"despachado"`  
Excluir: `"recibido"` | `"cancelado"` | `"borrador"`

### Estado visual

| Estado del pedido | Badge mostrado |
|---|---|
| `"enviado"` / `"en_preparacion"` | "Listo para despachar" (verde) |
| `"despachado"` | "En camino" (azul) |

### Acción "Marcar como despachado"

Solo visible para pedidos en `"enviado"` / `"en_preparacion"`.

Secuencia:
1. `crearRemito({ pedidoFabricaId: pedido.id, destinoLocationId, destinoNombre, origenLocationId, origenNombre, items })`  
   — `items` se construyen desde `pedido.items` mapeando `cantidadPedida → cantidadEnviada`
2. Si `ok`, llama `marcarEnCamino(remitoId)`
3. Toast de éxito/error

El pedido cambia a `"despachado"` automáticamente en el step 1 (lo hace `crearRemito` en Firestore).

### Layout

```
[Header: ‹ Despachar pedidos | count badge]
[Para cada pedido activo:]
  Destino · badge-estado
  Items resumidos (texto)
  [Si listo: btn "Marcar como despachado"]
[Contador footer: X de Y despachados]
```

---

## Pantalla 4: Recibir pedido (`/stock-console/recepcion`)

**Hook:** `useLogistica(user)`

### Datos usados

| Dato | Uso |
|---|---|
| `remitosRecibidos` | Filtrado a `estado === "en_camino"` |

### Estado local por remito

```ts
type RecepcionState = {
  cantidades: Record<string, number>  // productoId → cantidadRecibida
  observacion: string
  loading: boolean
}
```

Inicializar `cantidades` con `item.cantidadEnviada` por defecto (asumimos recepción completa).

### Validación visual

Si `cantidades[id] < item.cantidadEnviada` → input con borde rojo + ícono ⚠

### Acción "Confirmar recepción"

Llama `confirmarRecepcion`:
```ts
{
  remitoId: remito.id,
  items: remito.items.map(item => ({
    productoId: item.productoId,
    productoNombre: item.productoNombre,
    cantidadEnviada: item.cantidadEnviada,
    cantidadRecibida: cantidades[item.productoId] ?? item.cantidadEnviada,
  })),
  observacion: observacion || undefined,
}
```

### Layout

```
[Header: ‹ Recibir pedido]
[Para cada remito en_camino:]
  Origen · número remito · badge "en camino"
  Para cada item:
    nombre · "Enviado: X unidad"
    [input número] unidad [⚠ si falta]
  [Observaciones textarea]
  [Confirmar recepción]
[Si no hay remitos: estado vacío]
```

---

## Estilo y UX

### Colores principales

| Uso | Color |
|---|---|
| Botón primario / acción | `#1D9E75` (verde) |
| Badge OK / listo | `bg-[#E1F5EE] text-[#0F6E56]` |
| Badge pendiente / naranja | `bg-orange-50 text-orange-700` |
| Badge en camino / azul | `bg-blue-50 text-blue-700` |
| Badge bajo / rojo | `bg-red-50 text-red-700` |
| Input con error | `border-red-400` |

### Header de subpantalla

```tsx
<div className="flex items-center gap-3 p-4 border-b">
  <button onClick={() => router.back()}>‹</button>
  <h1>{titulo}</h1>
</div>
```

### Mobile-first

- Sin tablas con scroll horizontal en móvil (la tabla del pedido usa celdas flexibles).
- Contadores con botones de 44px mínimo (touch target).
- Bottom bar fixed con botones de acción principales.
- Sin modales excepto confirmaciones críticas (toast para feedback).

---

## Restricciones

- **No modificar** `hooks/use-stock-console.ts`, `hooks/use-logistica.ts`, `contexts/data-context.tsx`
- **No modificar** `components/pwa/pwa-shell.tsx` ni los tabs de navegación
- El `StockConsoleContent` existente **no se elimina** (puede usarse desde otras rutas)
- TypeScript estricto: no usar `any` en código nuevo

---

## Casos borde

| Caso | Comportamiento |
|---|---|
| Sin pedidos hoy en pantalla Pedido | Texto "No hay pedidos hoy. El pedido se genera automáticamente al recibir con faltantes." |
| Sin remitos en_camino en pantalla Recepción | Texto "No hay pedidos en camino hacia tu sucursal." |
| Sin pedidos activos en Despacho | Texto "No hay pedidos para despachar." |
| Sin productos en grupo seleccionado | Texto "Este grupo no tiene productos." |
| `locationId` null en usuario | Deshabilitar acciones y mostrar aviso "Sin ubicación configurada" |
| `crearRemito` falla por stock insuficiente | Toast de error con el mensaje del servicio |
