# Despacho PWA Unificado — Diseño

**Fecha:** 2026-04-21  
**Estado:** Aprobado

## Problema

La página `/stock-console/despacho` del PWA solo permite despachar pedidos ya existentes con un botón simple. No tiene:
- Vista por grupos (`grupos_catalogo`)
- Auto-pedidos calculados desde stock mínimo
- Paso de "tomar" pedido (`en_preparacion`)
- Inputs de cantidad al despachar

El dashboard `/dashboard/logistica-fabrica` (pestaña "hoy") sí tiene todo eso, pero la lógica vive inline en el componente de página. Ambas páginas deberían mostrar y operar los mismos datos con el mismo flujo.

## Solución

Extraer la lógica compartida a un hook `useDespachoHoy`. El dashboard lo adopta sin cambios de UI. El PWA se reescribe con ese hook y expone 4 vistas mobile-optimizadas.

## Archivos

### Nuevos
- `lib/logistica-utils.ts` — función `buildAutoPedidosPorOperador` (movida desde el dashboard)
- `hooks/use-despacho-hoy.ts` — hook compartido
- `app/pwa/[companySlug]/stock-console/despacho/page.tsx` — reescritura completa

### Modificados
- `app/dashboard/logistica-fabrica/page.tsx` — adopta `useDespachoHoy`, elimina lógica inline y `console.log` de debug

## Hook `useDespachoHoy`

```ts
function useDespachoHoy(user: User | null): {
  // datos
  gruposVisibles: GrupoCatalogo[]
  pedidosDeHoy: Array<{ grupo: GrupoCatalogo; pedidos: PedidoFabrica[]; autoPedidos: PedidoFabrica[] }>
  loading: boolean
  locationId: string
  nombrePorLocationId: Map<string, string>

  // estado de UI (vive en el hook, compartido)
  gruposEnModoDespacho: Record<string, boolean>
  cantidadesDespacho: Record<string, Record<string, number>>
  setCantidadDespacho: (grupoId: string, productoId: string, pedidoId: string, cantidad: number) => void

  // acciones
  tomarGrupo: (grupoId: string, pedidos: PedidoFabrica[], opcion: "todos" | "confirmados" | "manual", seleccion?: string[]) => Promise<void>
  despacharGrupo: (grupoId: string, pedidos: PedidoFabrica[], sucursalesAFiltrar?: string[]) => Promise<void>
  aceptarAutoPedido: (pedido: PedidoFabrica) => Promise<string | null>
}
```

**Subscripciones internas:**
- `pedidosRaw` y `remitosRaw` vía `useLogistica`
- `gruposCatalogo` vía `useGruposCatalogo`
- `stockFilas` vía `onSnapshot` en `stock_ubicaciones` filtrado por `grupoCatalogoId in gruposVisiblesIds`
- `ubicaciones` vía `useUbicacionesCatalogo` para el mapa `locationId → nombre`

**Filtro de grupos visibles:**
```
grupo.despachadores.some(d => d.locationId === despachadorLocationId)
&& grupo.diasEnvio?.includes(HOY)
```

## PWA — Flujo de 2 pasos

### Paso 1: Ver pedidos
- Cards colapsables por grupo
- Muestra pedidos confirmados + auto-pedidos (badge Controlado/Automático)
- Botón "Tomar" abre bottom sheet con opciones: Todos / Solo confirmados / Manual (checkboxes)
- Al confirmar tomar: llama `tomarGrupo`, activa modo despacho para ese grupo

### Paso 2: Modo despacho
- El grupo muestra inputs de cantidad
- Las 4 vistas cambian la presentación pero comparten el mismo estado `cantidadesDespacho`
- Botón "Despachar" por grupo, abre confirmación → llama `despacharGrupo`

## PWA — 4 Vistas

Selector fijo en la parte superior (4 íconos). La vista seleccionada persiste en `localStorage` como preferencia del usuario.

### Vista Producto
Acordeón por producto. Cada fila muestra el nombre del producto. Al expandir: lista de sucursales con su cantidad pedida. En modo despacho: input de cantidad por sucursal. Botón "OK" en el producto para rellenar todas las sucursales con `cantidadPedida`.

### Vista Sucursal
Acordeón por sucursal. Badge Controlado/Automático junto al nombre. Al expandir: lista de productos con cantidad pedida. En modo despacho: input de cantidad por producto.

### Vista Resumen
Lista plana. Un ítem por producto con el total pedido (suma de todas las sucursales). En modo despacho: total despachado junto al total pedido. Sin inputs — es solo lectura para saber qué preparar.

### Vista Tabla
Scroll horizontal. Filas = productos, columnas = sucursales. Header con nombre de sucursal y badge. En modo despacho: celdas con input numérico pequeño. Botón "OK" en columna Total por fila de producto.

## Dashboard — Cambios

Solo refactoring interno, sin cambios de UI:

1. Eliminar `buildAutoPedidosPorOperador` inline → importar desde `lib/logistica-utils.ts`
2. Eliminar query de `stockFilas`, cálculo de `gruposVisibles`, `pedidosDeHoy`, `handleTomarPedidos`, `handleDespacharGrupo`, `aceptarAutoPedido` → reemplazar con `useDespachoHoy`
3. Eliminar los 3 bloques de `console.log` de debug
4. `GrupoTablaView` sigue siendo un componente local del dashboard (no se comparte con PWA)

## Conexión en tiempo real

Ambas páginas ya operan sobre el mismo Firebase. No se requiere infraestructura adicional. Las acciones de una página se reflejan en la otra vía `onSnapshot` en milisegundos.

## Estado compartido vs local

El estado `gruposEnModoDespacho` y `cantidadesDespacho` vive **dentro del hook** pero es por instancia. Si el mismo usuario abre dashboard y PWA en simultáneo, el estado de UI no se sincroniza (son dos instancias del hook). Solo el estado persistido en Firebase se sincroniza. Esto es aceptable.

## Casos borde

- **Sin grupos asignados hoy:** mensaje "No hay grupos asignados para hoy."
- **Grupo sin pedidos ni diferencias de stock:** se muestra el grupo colapsado con descripción "Sin pedidos"
- **Auto-pedido fallido al registrar:** toast de error, no se avanza al paso de despacho
- **Despacho parcial:** `cantidadEnviada: 0` items se omiten del remito (no se crean ítems vacíos)
- **Usuario sin `locationId`:** se muestra error en lugar de la página
