# Fábrica — Tabs "Hoy" e "Historial"

**Fecha:** 2026-04-16  
**Módulo:** `/dashboard/logistica-fabrica`  
**Contexto:** Vista de lectura para que la fábrica vea qué pidieron las sucursales hoy y el histórico por grupo/sucursal.

---

## Objetivo

Agregar dos pestañas nuevas al inicio de la página `logistica-fabrica/page.tsx`:

| Tab | Propósito |
|-----|-----------|
| **Hoy** | Pedidos del día agrupados por grupo de productos, con columnas por sucursal |
| **Historial** | Histórico de pedidos de una sucursal para un grupo, columnas = días |

Las pestañas existentes ("Pedidos de hoy" y "Remitos activos") no se modifican.

---

## Modelo de datos relevante

- **Colección:** `pedidos_fabrica`
- **Campo origen:** `origenLocationId` / `origenNombre` → la sucursal que pidió
- **Campo grupo:** `grupoPedidoId` / `grupoPedidoNombre`
- **Items:** `items[].productoId`, `items[].productoNombre`, `items[].cantidadPedida`
- **Timestamp:** `creadoEn` (Firestore Timestamp)
- **Estado relevante:**
  - Confirmado = `"enviado" | "en_preparacion" | "despachado" | "recibido"`
  - No confirmado = `"borrador" | "cancelado"`

**Fuente de datos:** `pedidosRaw` del hook existente `use-logistica.ts` (ya suscripto en tiempo real para admin). No se requieren nuevas queries Firestore.

---

## Pantalla 1 — "Hoy"

### Comportamiento general
- Una Card colapsable por cada grupo que tiene al menos un pedido histórico.
- Al cargar: **todas las cards colapsadas**.
- Click en card → expande/colapsa.

### Derivación de datos
1. **Grupos con historial:** `distinct(pedidosRaw, 'grupoPedidoId')` → cards a renderizar.
2. **Sucursales por grupo (columnas):** `distinct(pedidosRaw.filter(g), 'origenLocationId')` — todas las sucursales que alguna vez pidieron de ese grupo.
3. **Pedidos de hoy confirmados:** `pedidosRaw.filter(p => isToday(p.creadoEn) && !["borrador","cancelado"].includes(p.estado))`.
4. **Productos de hoy (filas):** unión de `items[].productoNombre` de todos los pedidos confirmados del grupo hoy.

### Header de la card
```
{grupoPedidoNombre}  —  {nConfirmadas} de {nTotal} confirmadas
```

### Tabla expandida

| Producto | Sucursal A | Sucursal B | ... | Total |
|----------|-----------|-----------|-----|-------|
| Coca cola | 10 | `[Pendiente]` | | 10 |
| Fanta | 2 | `[Pendiente]` | | 2 |

- **Celda confirmada:** cantidad pedida (0 si confirmó en 0).
- **Celda Pendiente:** Badge amarillo `"Pendiente"` — cuando la sucursal NO tiene pedido confirmado de ese grupo hoy.
- **Columna Total:** suma de cantidades confirmadas únicamente (sin contar celdas Pendiente).
- **"Sin pedidos hoy":** si ninguna sucursal tiene pedido confirmado de ese grupo hoy, la card muestra ese mensaje sin tabla.

### Mobile
Contenedor de la tabla: `overflow-x-auto` con `min-w-max` en la tabla.

---

## Pantalla 2 — "Historial"

### Filtros (arriba de la tabla)
1. **Grupo** — Select con todos los grupos que tienen pedidos en `pedidosRaw`.
2. **Sucursal** — Select con todas las sucursales que ordenaron de ese grupo.
3. **Rango** — Select: `7 días` (default) / `14 días` / `30 días`.

Cuando cambia el grupo, la sucursal se resetea.

### Derivación de datos
- Filtrar `pedidosRaw` por `grupoPedidoId + origenLocationId + creadoEn >= ahora - rangoDías`.
- Pedidos confirmados = misma regla que "Hoy" (`estado` no es borrador/cancelado).
- **Filas (productos):** unión de `items[].productoNombre` de todos los pedidos filtrados.
- **Columnas (días):** todos los días del rango, formato `"Lun 14"`, `"Mar 15"`.

### Tabla

| Producto | Lun 14 | Mar 15 | ... | Prom |
|----------|--------|--------|-----|------|
| Coca cola | 10 | 8 | | 10 |
| Fanta | 2 | — | | 2 |

- **Celda con datos:** `cantidadPedida` del ítem en ese pedido.
- **Celda sin pedido:** `—`
- **Prom:** promedio de días donde hubo pedido (excluye días con `—`), redondeado al entero más cercano.

### Estado inicial
Mostrar tabla vacía con mensaje "Seleccioná un grupo y una sucursal" cuando no hay selección completa.

### Mobile
Mismo `overflow-x-auto` que "Hoy".

---

## Estructura de archivos nuevos

```
components/logistica/
  pedidos-hoy-view.tsx       ← Pantalla "Hoy"
  pedidos-historial-view.tsx ← Pantalla "Historial"
```

Modificación:
```
app/dashboard/logistica-fabrica/page.tsx  ← agregar 2 tabs al inicio
```

---

## Permisos

Misma guarda que la página actual: `canUser("ver_logistica")`. Las tabs solo se renderizan si esa condición es verdadera (ya garantizado por el layout de la página).

---

## Componentes UI a usar

Siguiendo patrones existentes del proyecto:
- `Card`, `CardHeader`, `CardTitle`, `CardContent` — contenedores
- `Badge` — estado Pendiente (variant `"secondary"` o color amarillo custom)
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` — navegación
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` — filtros Historial
- Lucide: `ChevronDown` / `ChevronRight` — indicador colapso, `Loader2` — loading

---

## Fuera de scope

- Escritura o edición de pedidos.
- Alertas push cuando llega un pedido nuevo.
- Exportación a CSV/Excel.
- Paginación (la colección es pequeña por empresa).
