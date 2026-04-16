# Fábrica — Tabs "Hoy" e "Historial" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar dos pestañas de lectura ("Hoy" e "Historial") al inicio de `/dashboard/logistica-fabrica` para que la fábrica vea qué pidieron las sucursales hoy y el histórico por grupo/sucursal.

**Architecture:** Dos componentes nuevos en `components/logistica/` reciben `pedidosRaw` (ya disponible en el hook existente) y derivan toda la lógica client-side sin queries Firestore adicionales. La página `logistica-fabrica/page.tsx` agrega dos `TabsTrigger`/`TabsContent` al inicio del `<Tabs>` existente.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, shadcn/ui (Card, Badge, Tabs, Select), Lucide React, Firebase Firestore Timestamps.

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `components/logistica/pedidos-hoy-view.tsx` | **Crear** — Pantalla "Hoy": cards colapsables por grupo, tabla producto × sucursal |
| `components/logistica/pedidos-historial-view.tsx` | **Crear** — Pantalla "Historial": filtros + tabla producto × día |
| `app/dashboard/logistica-fabrica/page.tsx` | **Modificar** — importar los dos componentes y agregar 2 tabs al inicio |

---

## Task 1: Componente `PedidosHoyView`

**Files:**
- Create: `components/logistica/pedidos-hoy-view.tsx`

- [ ] **Step 1: Crear el archivo con el componente completo**

```tsx
// components/logistica/pedidos-hoy-view.tsx
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { PedidoFabrica } from "@/lib/logistica-types"

const ESTADOS_CONFIRMADOS = new Set(["enviado", "en_preparacion", "despachado", "recibido"])

function isToday(timestamp: unknown): boolean {
  if (!timestamp || typeof timestamp !== "object") return false
  const ts = timestamp as { toDate?: () => Date }
  const date = ts.toDate?.()
  if (!date) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export function PedidosHoyView({ pedidos }: { pedidos: PedidoFabrica[] }) {
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})

  const toggle = (grupoId: string) =>
    setAbiertos((prev) => ({ ...prev, [grupoId]: !prev[grupoId] }))

  // Grupos únicos derivados de toda la colección
  const grupos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidos) {
      if (!map.has(p.grupoPedidoId)) map.set(p.grupoPedidoId, p.grupoPedidoNombre)
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos])

  // Pedidos de hoy confirmados (todos los grupos)
  const pedidosHoyConfirmados = useMemo(
    () => pedidos.filter((p) => isToday(p.creadoEn) && ESTADOS_CONFIRMADOS.has(p.estado)),
    [pedidos]
  )

  if (grupos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pedidos registrados aún.</p>
  }

  return (
    <div className="space-y-3">
      {grupos.map(({ id: grupoId, nombre: grupoNombre }) => {
        // Sucursales que ALGUNA VEZ pidieron este grupo (columnas)
        const sucursalesMap = new Map<string, string>()
        for (const p of pedidos) {
          if (p.grupoPedidoId === grupoId && !sucursalesMap.has(p.origenLocationId)) {
            sucursalesMap.set(p.origenLocationId, p.origenNombre)
          }
        }
        const sucursales = Array.from(sucursalesMap.entries())
          .map(([id, nombre]) => ({ id, nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))

        // Pedidos de HOY confirmados para este grupo
        const pedidosGrupoHoy = pedidosHoyConfirmados.filter(
          (p) => p.grupoPedidoId === grupoId
        )

        // Sucursales que ya confirmaron hoy
        const confirmadas = new Set(pedidosGrupoHoy.map((p) => p.origenLocationId))

        // Productos únicos de hoy (unión de items de pedidos confirmados)
        const productosMap = new Map<string, string>()
        for (const p of pedidosGrupoHoy) {
          for (const item of p.items) {
            if (!productosMap.has(item.productoId))
              productosMap.set(item.productoId, item.productoNombre)
          }
        }
        const productos = Array.from(productosMap.entries()).map(([id, nombre]) => ({
          id,
          nombre,
        }))

        const nConfirmadas = confirmadas.size
        const nTotal = sucursales.length
        const estaAbierto = abiertos[grupoId] ?? false

        return (
          <Card key={grupoId}>
            <button
              type="button"
              className="w-full text-left"
              onClick={() => toggle(grupoId)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{grupoNombre}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {nTotal === 0
                        ? "Sin sucursales registradas"
                        : `${nConfirmadas} de ${nTotal} confirmadas`}
                    </p>
                  </div>
                  {estaAbierto ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </button>

            {estaAbierto && (
              <CardContent>
                {productos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin pedidos confirmados hoy.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-max">
                      <thead>
                        <tr>
                          <th className="text-left p-2 border bg-muted font-medium">Producto</th>
                          {sucursales.map((s) => (
                            <th
                              key={s.id}
                              className="text-center p-2 border bg-muted font-medium min-w-[110px]"
                            >
                              {s.nombre}
                            </th>
                          ))}
                          <th className="text-center p-2 border bg-muted font-semibold text-blue-600 min-w-[70px]">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.map(({ id: productoId, nombre: productoNombre }) => {
                          const total = sucursales.reduce((acc, s) => {
                            if (!confirmadas.has(s.id)) return acc
                            const pedido = pedidosGrupoHoy.find(
                              (p) => p.origenLocationId === s.id
                            )
                            const item = pedido?.items.find((i) => i.productoId === productoId)
                            return acc + (item?.cantidadPedida ?? 0)
                          }, 0)

                          return (
                            <tr key={productoId}>
                              <td className="p-2 border font-medium">{productoNombre}</td>
                              {sucursales.map((s) => {
                                if (!confirmadas.has(s.id)) {
                                  return (
                                    <td key={s.id} className="p-2 border text-center">
                                      <Badge className="bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs">
                                        Pendiente
                                      </Badge>
                                    </td>
                                  )
                                }
                                const pedido = pedidosGrupoHoy.find(
                                  (p) => p.origenLocationId === s.id
                                )
                                const item = pedido?.items.find(
                                  (i) => i.productoId === productoId
                                )
                                return (
                                  <td key={s.id} className="p-2 border text-center">
                                    {item?.cantidadPedida ?? 0}
                                  </td>
                                )
                              })}
                              <td className="p-2 border text-center font-semibold text-blue-600">
                                {total}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que TypeScript no reporta errores**

```bash
cd "C:/Users/User/Desktop/horarios simple"
npx tsc --noEmit 2>&1 | grep "pedidos-hoy-view"
```

Expected: sin output (sin errores en ese archivo).

- [ ] **Step 3: Commit**

```bash
git add components/logistica/pedidos-hoy-view.tsx
git commit -m "feat: add PedidosHoyView component for fábrica tab"
```

---

## Task 2: Componente `PedidosHistorialView`

**Files:**
- Create: `components/logistica/pedidos-historial-view.tsx`

- [ ] **Step 1: Crear el archivo con el componente completo**

```tsx
// components/logistica/pedidos-historial-view.tsx
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PedidoFabrica } from "@/lib/logistica-types"

const ESTADOS_CONFIRMADOS = new Set(["enviado", "en_preparacion", "despachado", "recibido"])
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const RANGOS = [7, 14, 30] as const
type Rango = (typeof RANGOS)[number]

function timestampToDate(ts: unknown): Date | null {
  if (!ts || typeof ts !== "object") return null
  const obj = ts as { toDate?: () => Date }
  return obj.toDate?.() ?? null
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDia(date: Date): string {
  return `${DIAS_CORTOS[date.getDay()]} ${date.getDate()}`
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10)
}

export function PedidosHistorialView({ pedidos }: { pedidos: PedidoFabrica[] }) {
  const [grupoId, setGrupoId] = useState<string>("")
  const [sucursalId, setSucursalId] = useState<string>("")
  const [rango, setRango] = useState<Rango>(7)

  // Grupos únicos de toda la colección
  const grupos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidos) {
      if (!map.has(p.grupoPedidoId)) map.set(p.grupoPedidoId, p.grupoPedidoNombre)
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos])

  // Sucursales para el grupo seleccionado
  const sucursales = useMemo(() => {
    if (!grupoId) return []
    const map = new Map<string, string>()
    for (const p of pedidos) {
      if (p.grupoPedidoId === grupoId && !map.has(p.origenLocationId)) {
        map.set(p.origenLocationId, p.origenNombre)
      }
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [pedidos, grupoId])

  // Array de días del rango (incluyendo hoy, descendente → ascendente)
  const dias = useMemo(() => {
    const result: Date[] = []
    const hoy = startOfDay(new Date())
    for (let i = rango - 1; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(d.getDate() - i)
      result.push(d)
    }
    return result
  }, [rango])

  // Pedidos filtrados por grupo + sucursal + rango
  const pedidosFiltrados = useMemo(() => {
    if (!grupoId || !sucursalId) return []
    const desde = dias[0]
    return pedidos.filter((p) => {
      if (p.grupoPedidoId !== grupoId) return false
      if (p.origenLocationId !== sucursalId) return false
      if (!ESTADOS_CONFIRMADOS.has(p.estado)) return false
      const date = timestampToDate(p.creadoEn)
      if (!date) return false
      return startOfDay(date) >= desde
    })
  }, [pedidos, grupoId, sucursalId, dias])

  // Productos únicos de los pedidos filtrados
  const productos = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pedidosFiltrados) {
      for (const item of p.items) {
        if (!map.has(item.productoId)) map.set(item.productoId, item.productoNombre)
      }
    }
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [pedidosFiltrados])

  // Mapa de pedido por día (key = "YYYY-MM-DD")
  // Si hay >1 pedido el mismo día, se toma el primero encontrado
  const pedidoPorDia = useMemo(() => {
    const map = new Map<string, PedidoFabrica>()
    for (const p of pedidosFiltrados) {
      const date = timestampToDate(p.creadoEn)
      if (!date) continue
      const k = dayKey(date)
      if (!map.has(k)) map.set(k, p)
    }
    return map
  }, [pedidosFiltrados])

  const handleGrupoChange = (val: string) => {
    setGrupoId(val)
    setSucursalId("")
  }

  const grupoNombre = grupos.find((g) => g.id === grupoId)?.nombre ?? ""
  const sucursalNombre = sucursales.find((s) => s.id === sucursalId)?.nombre ?? ""

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={grupoId} onValueChange={handleGrupoChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Grupo de productos" />
          </SelectTrigger>
          <SelectContent>
            {grupos.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sucursalId} onValueChange={setSucursalId} disabled={!grupoId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            {sucursales.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(rango)} onValueChange={(v) => setRango(Number(v) as Rango)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGOS.map((r) => (
              <SelectItem key={r} value={String(r)}>
                Últimos {r} días
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Estado vacío */}
      {(!grupoId || !sucursalId) && (
        <p className="text-sm text-muted-foreground">
          Seleccioná un grupo y una sucursal para ver el historial.
        </p>
      )}

      {/* Tabla */}
      {grupoId && sucursalId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {grupoNombre} — {sucursalNombre}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Últimos {rango} días</p>
          </CardHeader>
          <CardContent>
            {productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin pedidos en este período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border bg-muted font-medium">Producto</th>
                      {dias.map((d) => (
                        <th
                          key={d.toISOString()}
                          className="text-center p-2 border bg-muted font-medium min-w-[70px]"
                        >
                          {formatDia(d)}
                        </th>
                      ))}
                      <th className="text-center p-2 border bg-muted font-semibold text-blue-600 min-w-[60px]">
                        Prom
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map(({ id: productoId, nombre: productoNombre }) => {
                      const cantidades: (number | null)[] = dias.map((d) => {
                        const pedido = pedidoPorDia.get(dayKey(d))
                        if (!pedido) return null
                        const item = pedido.items.find((i) => i.productoId === productoId)
                        return item != null ? item.cantidadPedida : null
                      })
                      const conDatos = cantidades.filter((c): c is number => c !== null)
                      const prom =
                        conDatos.length > 0
                          ? Math.round(
                              conDatos.reduce((a, b) => a + b, 0) / conDatos.length
                            )
                          : null

                      return (
                        <tr key={productoId}>
                          <td className="p-2 border font-medium">{productoNombre}</td>
                          {cantidades.map((c, i) => (
                            <td key={i} className="p-2 border text-center">
                              {c !== null ? (
                                c
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          ))}
                          <td className="p-2 border text-center font-semibold text-blue-600">
                            {prom !== null ? (
                              prom
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "C:/Users/User/Desktop/horarios simple"
npx tsc --noEmit 2>&1 | grep "pedidos-historial-view"
```

Expected: sin output.

- [ ] **Step 3: Commit**

```bash
git add components/logistica/pedidos-historial-view.tsx
git commit -m "feat: add PedidosHistorialView component for fábrica historial tab"
```

---

## Task 3: Agregar las dos pestañas a `logistica-fabrica/page.tsx`

**Files:**
- Modify: `app/dashboard/logistica-fabrica/page.tsx`

- [ ] **Step 1: Agregar los imports de los dos componentes nuevos**

En `app/dashboard/logistica-fabrica/page.tsx`, después de la línea:
```tsx
import type { PedidoFabrica, RemitoLogItem } from "@/lib/logistica-types"
```

Agregar:
```tsx
import { PedidosHoyView } from "@/components/logistica/pedidos-hoy-view"
import { PedidosHistorialView } from "@/components/logistica/pedidos-historial-view"
```

- [ ] **Step 2: Agregar los dos TabsTrigger al inicio del TabsList**

Localizar en el archivo (alrededor de línea 632):
```tsx
        <Tabs defaultValue="pedidos">
          <TabsList>
            <TabsTrigger value="pedidos">Pedidos de hoy</TabsTrigger>
            <TabsTrigger value="activos">Remitos activos</TabsTrigger>
          </TabsList>
```

Reemplazar con:
```tsx
        <Tabs defaultValue="pedidos">
          <TabsList>
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos de hoy</TabsTrigger>
            <TabsTrigger value="activos">Remitos activos</TabsTrigger>
          </TabsList>
```

- [ ] **Step 3: Agregar los dos TabsContent antes del tab "pedidos" existente**

Localizar en el archivo (alrededor de línea 637):
```tsx
          {/* Tab pedidos de hoy - NUEVA ESTRUCTURA */}
          <TabsContent value="pedidos" className="space-y-4 mt-4">
```

Insertar ANTES de esa línea:
```tsx
          <TabsContent value="hoy" className="mt-4">
            <PedidosHoyView pedidos={pedidosRaw} />
          </TabsContent>

          <TabsContent value="historial" className="mt-4">
            <PedidosHistorialView pedidos={pedidosRaw} />
          </TabsContent>

```

- [ ] **Step 4: Verificar TypeScript del archivo completo**

```bash
cd "C:/Users/User/Desktop/horarios simple"
npx tsc --noEmit 2>&1 | grep "logistica-fabrica"
```

Expected: sin output.

- [ ] **Step 5: Levantar dev server y verificar visualmente**

```bash
cd "C:/Users/User/Desktop/horarios simple"
npm run dev
```

Abrir `http://localhost:3000/dashboard/logistica-fabrica`.

Verificar:
- [ ] Aparecen 4 tabs: "Hoy", "Historial", "Pedidos de hoy", "Remitos activos".
- [ ] Tab "Hoy": cards colapsadas por defecto, al hacer click se expanden y muestran tabla.
- [ ] Tab "Historial": dropdowns de grupo/sucursal/rango, tabla aparece al seleccionar grupo y sucursal.
- [ ] En mobile (DevTools, viewport 375px): las tablas tienen scroll horizontal.
- [ ] Las pestañas "Pedidos de hoy" y "Remitos activos" siguen funcionando igual.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/logistica-fabrica/page.tsx
git commit -m "feat: add Hoy and Historial tabs to logistica-fabrica page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Dos tabs nuevas "Hoy" e "Historial" al inicio del TabsList
- ✅ Cards colapsadas por defecto en "Hoy"
- ✅ Header: `{n} de {n} confirmadas`
- ✅ Columnas = sucursales con historial en ese grupo
- ✅ Badge amarillo "Pendiente" para sucursales sin pedido hoy
- ✅ Columna Total (solo suma confirmadas)
- ✅ "Sin pedidos confirmados hoy" cuando no hay datos del día
- ✅ Tres filtros en "Historial": grupo, sucursal, rango (default 7 días)
- ✅ Columnas por día en formato "Lun 14"
- ✅ Guion "—" para días sin pedido
- ✅ Columna Prom (promedio de días con pedido, excluye "—")
- ✅ `overflow-x-auto` + `min-w-max` en ambas tablas para scroll mobile
- ✅ Sin queries Firestore adicionales (usa `pedidosRaw` existente)
- ✅ Permisos: misma guarda que la página (`ver_logistica`)

**Placeholders:** ninguno.

**Type consistency:** `PedidoFabrica` importado del mismo `@/lib/logistica-types` en los tres archivos. `pedidosRaw: PedidoFabrica[]` es el prop en ambos componentes, coincide con el tipo en `use-logistica.ts`.
