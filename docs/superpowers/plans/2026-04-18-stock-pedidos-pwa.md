# Stock & Pedidos PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la página `/pwa/[companySlug]/stock-console` con una experiencia multi-pantalla: pantalla principal con 4 acciones y 4 subpantallas independientes (contar stock, ver/enviar pedido, despachar, recibir).

**Architecture:** Cada subpantalla es un Next.js App Router `page.tsx` cliente autónomo que llama a sus propios hooks. No hay estado compartido entre rutas. El guard de login (`if (!user) → LoginForm`) se repite en cada page.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, hooks existentes (`useStockConsole`, `useLogistica`, `useData`), Lucide icons.

**Spec:** `docs/superpowers/specs/2026-04-18-stock-pedidos-pwa-design.md`

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `app/pwa/[companySlug]/stock-console/page.tsx` | **Reemplazar** | Pantalla principal con 4 action cards |
| `app/pwa/[companySlug]/stock-console/stock/page.tsx` | **Crear** | Contar stock (modo work de useStockConsole) |
| `app/pwa/[companySlug]/stock-console/pedido/page.tsx` | **Crear** | Ver y enviar pedidos del día |
| `app/pwa/[companySlug]/stock-console/despacho/page.tsx` | **Crear** | Tomar y despachar pedidos |
| `app/pwa/[companySlug]/stock-console/recepcion/page.tsx` | **Crear** | Recibir pedidos en_camino |

---

## Task 1: Pantalla principal — 4 action cards

**Files:**
- Modify: `app/pwa/[companySlug]/stock-console/page.tsx`

- [ ] **Step 1: Reemplazar el contenido del page.tsx actual**

El archivo actual renderiza `<StockConsoleContent companySlug={companySlug} />`. Reemplazarlo completamente con:

```tsx
"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/contexts/data-context"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"

const ACTIONS = [
  {
    href: "stock-console/stock",
    icon: "📦",
    title: "Contar stock",
    desc: "Registrá lo que hay en tu sucursal",
    iconBg: "bg-[#E1F5EE]",
    section: "tareas",
  },
  {
    href: "stock-console/pedido",
    icon: "📋",
    title: "Ver y enviar pedido",
    desc: "Revisá las cantidades y mandalo",
    iconBg: "bg-blue-50",
    section: "tareas",
  },
  {
    href: "stock-console/despacho",
    icon: "🏭",
    title: "Tomar y despachar",
    desc: "Preparar y marcar remitos como despachados",
    iconBg: "bg-amber-50",
    section: "fabrica",
  },
  {
    href: "stock-console/recepcion",
    icon: "✅",
    title: "Recibir pedido",
    desc: "Confirmá lo que llegó a tu sucursal",
    iconBg: "bg-red-50",
    section: "fabrica",
  },
]

export default function StockPedidosHome() {
  const params = useParams()
  const router = useRouter()
  const { user } = useData()
  const companySlug = params.companySlug as string

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const tareas = ACTIONS.filter((a) => a.section === "tareas")
  const fabrica = ACTIONS.filter((a) => a.section === "fabrica")

  return (
    <div className="min-h-screen bg-[#f5f5f3] pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">Stock & Pedidos</h1>
      </div>

      <div className="px-4 space-y-6">
        <section>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Mis tareas
          </p>
          <div className="space-y-2">
            {tareas.map((action) => (
              <ActionCard
                key={action.href}
                action={action}
                onClick={() => router.push(`/pwa/${companySlug}/${action.href}`)}
              />
            ))}
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Fábrica
          </p>
          <div className="space-y-2">
            {fabrica.map((action) => (
              <ActionCard
                key={action.href}
                action={action}
                onClick={() => router.push(`/pwa/${companySlug}/${action.href}`)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ActionCard({
  action,
  onClick,
}: {
  action: (typeof ACTIONS)[number]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-[#ebebeb] rounded-xl px-4 py-3 flex items-center gap-3 active:bg-gray-50 transition-colors text-left"
    >
      <div
        className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-xl shrink-0 ${action.iconBg}`}
      >
        {action.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-gray-900">{action.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
      </div>
      <span className="text-gray-300 text-lg">›</span>
    </button>
  )
}
```

- [ ] **Step 2: Verificar en navegador**

```bash
npm run dev
```

Abrir `http://localhost:3000/pwa/TEST_SLUG/stock-console`. Verificar:
- Se ven las 4 action cards con sus íconos y descripciones
- Hay dos secciones: "Mis tareas" y "Fábrica"
- Sin usuario → muestra LoginForm

- [ ] **Step 3: Commit**

```bash
git add app/pwa/\[companySlug\]/stock-console/page.tsx
git commit -m "feat(pwa): pantalla principal Stock & Pedidos con 4 action cards"
```

---

## Task 2: Pantalla "Contar stock"

**Files:**
- Create: `app/pwa/[companySlug]/stock-console/stock/page.tsx`

**Contexto del hook `useStockConsole(user)`:**
- `pedidos[]` — array de `{ id: string, nombre: string }` (grupos)
- `state.selectedPedidoId` — id del grupo seleccionado
- `productos[]` — array de `{ id, nombre, unidad, stockMinimoUnits, ... }`
- `state.cantidades` — `Record<productoId, number>` (deltas de movimiento)
- `state.loading` — boolean
- `stockActual` — `Record<productoId, number>` (stock real actual)
- `setSelectedPedidoId(id)` — seleccionar grupo
- `incrementarCantidad(id, 1)` — suma 1 al delta
- `decrementarCantidad(id, 1)` — resta 1 al delta (no baja del negativo del stock)
- `limpiarCantidades()` — resetea cantidades a {}
- `confirmarMovimientos()` — persiste en Firestore, devuelve boolean

**`getStockStatus`** de `@/lib/stock-status`:
- `"CRITICAL"` → badge rojo "Bajo"
- `"LOW"` → badge naranja "Regular"
- `"OK"` → badge verde "OK"

- [ ] **Step 1: Crear el archivo**

```tsx
"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/contexts/data-context"
import { useStockConsole } from "@/hooks/use-stock-console"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { getStockStatus } from "@/lib/stock-status"
import { ChevronLeft, Package } from "lucide-react"

export default function ContarStockPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useData()
  const companySlug = params.companySlug as string

  // Hook siempre llamado antes de cualquier return (regla de hooks)
  const {
    state,
    pedidos,
    productos,
    stockActual,
    setSelectedPedidoId,
    incrementarCantidad,
    decrementarCantidad,
    limpiarCantidades,
    confirmarMovimientos,
  } = useStockConsole(user)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedPedido = pedidos.find((p) => p.id === state.selectedPedidoId)
  const hayMovimientos = Object.values(state.cantidades).some((v) => v !== 0)

  const handleGuardar = async () => {
    await confirmarMovimientos()
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Contar stock</h1>
        {selectedPedido && (
          <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
            {selectedPedido.nombre}
          </span>
        )}
      </div>

      {/* Chips de grupos */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {pedidos.map((pedido) => (
            <button
              key={pedido.id}
              onClick={() => setSelectedPedidoId(pedido.id)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                state.selectedPedidoId === pedido.id
                  ? "bg-[#E1F5EE] border-[#1D9E75] text-[#0F6E56] font-medium"
                  : "bg-white border-gray-200 text-gray-500"
              }`}
            >
              {pedido.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Info box */}
      <div className="px-4 pt-3 pb-1 shrink-0">
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          Ingresá el stock real. Si no cambia, dejalo igual.
        </p>
      </div>

      {/* Lista de productos */}
      <div className="flex-1 px-4 py-2 overflow-y-auto">
        {!state.selectedPedidoId && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Package className="w-12 h-12" />
            <p className="text-sm">Seleccioná un grupo para comenzar</p>
          </div>
        )}

        {state.selectedPedidoId && productos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Package className="w-12 h-12" />
            <p className="text-sm">Este grupo no tiene productos</p>
          </div>
        )}

        {productos.map((producto) => {
          const cantidad = state.cantidades[producto.id] ?? 0
          const stock = stockActual[producto.id] ?? 0
          const status = getStockStatus(producto, stock)

          return (
            <div
              key={producto.id}
              className="flex items-center py-3 border-b border-gray-100 last:border-b-0 gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{producto.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {producto.unidad} · mínimo {producto.stockMinimoUnits ?? 0}
                </p>
              </div>

              <StockBadge status={status} />

              {/* Contador */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => decrementarCantidad(producto.id, 1)}
                  disabled={state.loading}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 text-lg active:bg-gray-100 disabled:opacity-40"
                >
                  −
                </button>
                <span
                  className={`w-8 text-center text-base font-semibold tabular-nums ${
                    cantidad !== 0 ? "text-[#1D9E75]" : "text-gray-800"
                  }`}
                >
                  {cantidad}
                </span>
                <button
                  onClick={() => incrementarCantidad(producto.id, 1)}
                  disabled={state.loading}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 text-lg active:bg-gray-100 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom bar */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-2 shrink-0">
        <button
          onClick={limpiarCantidades}
          disabled={state.loading || !hayMovimientos}
          className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm border border-gray-200 disabled:opacity-40"
        >
          Limpiar
        </button>
        <button
          onClick={handleGuardar}
          disabled={state.loading || !hayMovimientos}
          className="flex-1 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
        >
          {state.loading ? "Guardando…" : "Guardar stock"}
        </button>
      </div>
    </div>
  )
}

function StockBadge({ status }: { status: "OK" | "LOW" | "CRITICAL" }) {
  if (status === "OK") {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 shrink-0">
        OK
      </span>
    )
  }
  if (status === "LOW") {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">
        Regular
      </span>
    )
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 shrink-0">
      Bajo
    </span>
  )
}
```

- [ ] **Step 2: Verificar en navegador**

```bash
npm run dev
```

Navegar a `http://localhost:3000/pwa/TEST_SLUG/stock-console/stock`. Verificar:
- Header con `‹` que vuelve atrás
- Chips de grupos (si hay datos)
- Lista de productos con badges y contadores
- Botón "Guardar stock" deshabilitado cuando no hay cambios
- El `+` incrementa el número verde, el `−` lo decrementa

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores en el archivo nuevo.

- [ ] **Step 4: Commit**

```bash
git add "app/pwa/[companySlug]/stock-console/stock/page.tsx"
git commit -m "feat(pwa): pantalla Contar stock con chips de grupos y contadores"
```

---

## Task 3: Pantalla "Ver y enviar pedido"

**Files:**
- Create: `app/pwa/[companySlug]/stock-console/pedido/page.tsx`

**Contexto del hook `useLogistica(user)`:**
- `pedidosPropios` — `PedidoFabrica[]` donde `origenLocationId === locationId`
- `loading` — boolean
- `locationId` — string | null (desde userData)
- `crearPedidoFabrica(input)` — crea pedido en "enviado", devuelve `{ ok, pedidoId?, error? }`
- `actualizarItemsPedido(pedidoId, items)` — actualiza items de un pedido existente

**`PedidoFabrica` relevante:**
```ts
{
  id: string
  origenLocationId: string; origenNombre: string
  destinoLocationId: string; destinoNombre: string
  grupoPedidoId: string; grupoPedidoNombre: string
  estado: "borrador" | "enviado" | "en_preparacion" | "despachado" | "recibido" | "cancelado"
  esPendiente: boolean
  items: { productoId, productoNombre, cantidadSugerida, cantidadPedida }[]
  creadoEn: unknown  // Firestore Timestamp
}
```

**Filtro "del día":** `creadoEn` es un Firestore Timestamp con campo `.toDate()` o `.seconds`. Usar:
```ts
function esDeHoy(creadoEn: unknown): boolean {
  try {
    const ts = creadoEn as any
    const date = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts?.seconds * 1000)
    const hoy = new Date()
    return (
      date.getDate() === hoy.getDate() &&
      date.getMonth() === hoy.getMonth() &&
      date.getFullYear() === hoy.getFullYear()
    )
  } catch {
    return false
  }
}
```

- [ ] **Step 1: Crear el archivo**

```tsx
"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ClipboardList } from "lucide-react"
import type { PedidoFabricaItem } from "@/lib/logistica-types"

function esDeHoy(creadoEn: unknown): boolean {
  try {
    const ts = creadoEn as any
    const date = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts?.seconds * 1000)
    const hoy = new Date()
    return (
      date.getDate() === hoy.getDate() &&
      date.getMonth() === hoy.getMonth() &&
      date.getFullYear() === hoy.getFullYear()
    )
  } catch {
    return false
  }
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  enviado: { label: "Enviado", cls: "bg-[#E1F5EE] text-[#0F6E56]" },
  en_preparacion: { label: "En preparación", cls: "bg-blue-50 text-blue-700" },
  despachado: { label: "Despachado", cls: "bg-blue-50 text-blue-700" },
  recibido: { label: "Recibido", cls: "bg-gray-100 text-gray-500" },
  cancelado: { label: "Cancelado", cls: "bg-red-50 text-red-600" },
  borrador: { label: "Pendiente", cls: "bg-amber-50 text-amber-700" },
}

export default function VerPedidoPage() {
  const params = useParams()
  const router = useRouter()
  const { user, userData } = useData()
  const { toast } = useToast()
  const companySlug = params.companySlug as string

  const { pedidosPropios, loading, crearPedidoFabrica } = useLogistica(user)

  // cantidades editables: pedidoId → productoId → cantidad
  const [cantidades, setCantidades] = useState<Record<string, Record<string, number>>>({})
  const [enviando, setEnviando] = useState<string | null>(null)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const pedidosHoy = pedidosPropios.filter((p) => esDeHoy(p.creadoEn))
  const borradores = pedidosHoy.filter((p) => p.estado === "borrador")
  const enviados = pedidosHoy.filter((p) => p.estado !== "borrador")

  const getCantidad = (pedidoId: string, productoId: string, fallback: number) =>
    cantidades[pedidoId]?.[productoId] ?? fallback

  const setCantidadItem = (pedidoId: string, productoId: string, value: number) => {
    setCantidades((prev) => ({
      ...prev,
      [pedidoId]: { ...(prev[pedidoId] ?? {}), [productoId]: Math.max(0, value) },
    }))
  }

  const handleEnviar = async (pedidoId: string) => {
    const pedido = borradores.find((p) => p.id === pedidoId)
    if (!pedido) return

    const items: PedidoFabricaItem[] = pedido.items.map((item) => ({
      productoId: item.productoId,
      productoNombre: item.productoNombre,
      cantidadSugerida: item.cantidadSugerida,
      cantidadPedida: getCantidad(pedidoId, item.productoId, item.cantidadPedida),
    }))

    const itemsValidos = items.filter((i) => i.cantidadPedida > 0)
    if (itemsValidos.length === 0) {
      toast({ title: "Error", description: "Ingresá al menos un ítem con cantidad mayor a 0", variant: "destructive" })
      return
    }

    setEnviando(pedidoId)
    const result = await crearPedidoFabrica({
      origenLocationId: pedido.origenLocationId,
      origenNombre: pedido.origenNombre,
      destinoLocationId: pedido.destinoLocationId,
      destinoNombre: pedido.destinoNombre,
      grupoPedidoId: pedido.grupoPedidoId,
      grupoPedidoNombre: pedido.grupoPedidoNombre,
      items: itemsValidos,
    })
    setEnviando(null)

    if (result.ok) {
      toast({ title: "Pedido enviado", description: `Pedido a ${pedido.destinoNombre} enviado correctamente` })
    } else {
      toast({ title: "Error", description: result.error ?? "No se pudo enviar el pedido", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Pedido del día</h1>
        <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
          Hoy
        </span>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando pedidos…</p>
        )}

        {!loading && pedidosHoy.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <ClipboardList className="w-12 h-12" />
            <p className="text-sm text-center">
              No hay pedidos hoy.
              <br />
              El pedido se genera automáticamente al recibir con faltantes.
            </p>
          </div>
        )}

        {/* Borradores: editables y enviables */}
        {borradores.map((pedido) => (
          <div key={pedido.id} className="bg-white rounded-xl border border-[#ebebeb] mb-3 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{pedido.destinoNombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pedido.grupoPedidoNombre}</p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                Pendiente de envío
              </span>
            </div>

            {/* Info */}
            <div className="px-4 py-2">
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Cantidades calculadas según tu stock. Podés ajustar antes de enviar.
              </p>
            </div>

            {/* Tabla de items */}
            <div className="px-4 pb-2">
              <div className="flex text-[11px] text-gray-400 uppercase tracking-wide py-1.5 gap-2">
                <span className="flex-1">Producto</span>
                <span className="w-16 text-center">Sugerido</span>
                <span className="w-24 text-center">Enviar</span>
              </div>
              {pedido.items.map((item) => {
                const cant = getCantidad(pedido.id, item.productoId, item.cantidadPedida)
                return (
                  <div key={item.productoId} className="flex items-center gap-2 py-2 border-t border-gray-50">
                    <span className="flex-1 text-sm text-gray-800 truncate">{item.productoNombre}</span>
                    <span className="w-16 text-center text-sm text-gray-400">{item.cantidadSugerida}</span>
                    <div className="w-24 flex items-center gap-1 justify-center">
                      <button
                        onClick={() => setCantidadItem(pedido.id, item.productoId, cant - 1)}
                        className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-sm flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className={`w-7 text-center text-sm font-semibold ${cant !== item.cantidadPedida ? "text-[#1D9E75]" : "text-gray-800"}`}>
                        {cant}
                      </span>
                      <button
                        onClick={() => setCantidadItem(pedido.id, item.productoId, cant + 1)}
                        className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-sm flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Botón enviar */}
            <div className="px-4 pb-4">
              <button
                onClick={() => handleEnviar(pedido.id)}
                disabled={enviando === pedido.id}
                className="w-full py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
              >
                {enviando === pedido.id ? "Enviando…" : "Enviar pedido"}
              </button>
            </div>
          </div>
        ))}

        {/* Enviados: solo lectura */}
        {enviados.map((pedido) => {
          const badge = ESTADO_BADGE[pedido.estado] ?? { label: pedido.estado, cls: "bg-gray-100 text-gray-500" }
          return (
            <div key={pedido.id} className="bg-white rounded-xl border border-[#ebebeb] mb-3 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{pedido.destinoNombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pedido.grupoPedidoNombre}</p>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-400">
                  {pedido.items.map((i) => `${i.productoNombre} ×${i.cantidadPedida}`).join(" · ")}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en navegador**

Navegar a `/pwa/TEST_SLUG/stock-console/pedido`. Verificar:
- Si hay borradores: se ven con contadores ajustables y botón "Enviar pedido"
- Si no hay pedidos hoy: estado vacío con mensaje
- Los pedidos ya enviados aparecen como solo lectura con badge verde

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add "app/pwa/[companySlug]/stock-console/pedido/page.tsx"
git commit -m "feat(pwa): pantalla Ver y enviar pedido"
```

---

## Task 4: Pantalla "Tomar y despachar"

**Files:**
- Create: `app/pwa/[companySlug]/stock-console/despacho/page.tsx`

**Contexto del hook `useLogistica(user)`:**
- `pedidosParaMi` — pedidos con `destinoLocationId === locationId` y `estado !== "recibido"`
- `locationId` — string | null
- `userData.locationName` — string | undefined
- `crearRemito(input)` — crea remito, descuenta stock del origen, cambia pedido a "despachado". Devuelve `{ ok, remitoId?, error? }`
- `marcarEnCamino(remitoId)` — cambia remito a "en_camino". Devuelve `{ ok, error? }`

**`crearRemito` input:**
```ts
{
  pedidoFabricaId: string
  origenLocationId: string
  origenNombre: string
  destinoLocationId: string
  destinoNombre: string
  items: { productoId, productoNombre, cantidadEnviada, cantidadPedida? }[]
}
```

**Filtro de pedidos a mostrar:** estados `"enviado"` | `"en_preparacion"` | `"despachado"`

**Nota crítica:** `crearRemito` descuenta stock del origen (`origenLocationId`). En la pantalla de despacho, el origen es la ubicación de quien despacha (la fábrica o almacén). El `origenLocationId` viene de `pedido.origenLocationId` (quien creó el pedido es el destino, no el origen). El origen del remito es quien lo despacha.

En este contexto: la pantalla despacho la ve quien tiene los productos (fábrica). El origen del remito = `locationId` del usuario actual. El destino = `pedido.origenLocationId` (quien pidió).

- [ ] **Step 1: Crear el archivo**

```tsx
"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Truck } from "lucide-react"
import type { PedidoFabrica } from "@/lib/logistica-types"

const ESTADOS_ACTIVOS = new Set(["enviado", "en_preparacion", "despachado"])

export default function DespacharPage() {
  const params = useParams()
  const router = useRouter()
  const { user, userData } = useData()
  const { toast } = useToast()
  const companySlug = params.companySlug as string

  const { pedidosParaMi, loading, locationId, crearRemito, marcarEnCamino } = useLogistica(user)

  const [despachando, setDespachando] = useState<string | null>(null)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const pedidosActivos = pedidosParaMi.filter((p) => ESTADOS_ACTIVOS.has(p.estado))
  const listos = pedidosActivos.filter((p) => p.estado === "enviado" || p.estado === "en_preparacion")
  const enCamino = pedidosActivos.filter((p) => p.estado === "despachado")

  const handleDespachar = async (pedido: PedidoFabrica) => {
    if (!locationId) {
      toast({ title: "Error", description: "Sin ubicación configurada", variant: "destructive" })
      return
    }

    const items = pedido.items.map((item) => ({
      productoId: item.productoId,
      productoNombre: item.productoNombre,
      cantidadEnviada: item.cantidadPedida,
      cantidadPedida: item.cantidadPedida,
    }))

    setDespachando(pedido.id)
    const remitoResult = await crearRemito({
      pedidoFabricaId: pedido.id,
      origenLocationId: locationId,
      origenNombre: userData?.locationName ?? locationId,
      destinoLocationId: pedido.origenLocationId,
      destinoNombre: pedido.origenNombre,
      items,
    })

    if (!remitoResult.ok) {
      setDespachando(null)
      toast({ title: "Error al despachar", description: remitoResult.error ?? "Error desconocido", variant: "destructive" })
      return
    }

    const enCaminoResult = await marcarEnCamino(remitoResult.remitoId!)
    setDespachando(null)

    if (!enCaminoResult.ok) {
      toast({ title: "Error", description: enCaminoResult.error ?? "No se pudo marcar en camino", variant: "destructive" })
      return
    }

    toast({ title: "Remito despachado", description: `Pedido de ${pedido.origenNombre} marcado como en camino` })
  }

  const totalActivos = pedidosActivos.length
  const totalDespachados = enCamino.length

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Despachar pedidos</h1>
        {totalActivos > 0 && (
          <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
            Hoy · {totalActivos} pedidos
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando pedidos…</p>
        )}

        {!loading && pedidosActivos.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <Truck className="w-12 h-12" />
            <p className="text-sm text-center">No hay pedidos para despachar.</p>
          </div>
        )}

        {!loading && pedidosActivos.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Pedidos del día
            </p>

            {[...listos, ...enCamino].map((pedido) => {
              const isListo = pedido.estado === "enviado" || pedido.estado === "en_preparacion"
              const resumen = pedido.items
                .map((i) => `${i.productoNombre} ×${i.cantidadPedida}`)
                .join(" · ")

              return (
                <div
                  key={pedido.id}
                  className="bg-white rounded-xl border border-[#ebebeb] mb-3 px-4 py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{pedido.origenNombre}</p>
                    {isListo ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56]">
                        Listo para despachar
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        En camino
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{resumen}</p>
                  {isListo && (
                    <button
                      onClick={() => handleDespachar(pedido)}
                      disabled={despachando === pedido.id}
                      className="w-full py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
                    >
                      {despachando === pedido.id ? "Despachando…" : "Marcar como despachado"}
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Footer con contador */}
      {totalActivos > 0 && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 text-center shrink-0">
          <p className="text-sm text-gray-400">
            {totalDespachados} de {totalActivos} remitos despachados
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar en navegador**

Navegar a `/pwa/TEST_SLUG/stock-console/despacho`. Verificar:
- Pedidos con "Listo para despachar" muestran botón "Marcar como despachado"
- Pedidos "En camino" (ya despachados) se muestran sin botón
- Estado vacío cuando no hay pedidos activos
- Footer con contador

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add "app/pwa/[companySlug]/stock-console/despacho/page.tsx"
git commit -m "feat(pwa): pantalla Tomar y despachar con crearRemito + marcarEnCamino"
```

---

## Task 5: Pantalla "Recibir pedido"

**Files:**
- Create: `app/pwa/[companySlug]/stock-console/recepcion/page.tsx`

**Contexto del hook `useLogistica(user)`:**
- `remitosRecibidos` — `RemitoLog[]` donde `destinoLocationId === locationId`
- `confirmarRecepcion(input)` — devuelve `{ ok, error? }`

**`RemitoLog` relevante:**
```ts
{
  id: string
  numero: string
  origenNombre: string
  destinoNombre: string
  estado: "preparado" | "en_camino" | "entregado" | "cancelado"
  items: { productoId, productoNombre, cantidadEnviada, cantidadPedida? }[]
}
```

**`confirmarRecepcion` input (parcial — ownerId y user los inyecta el hook):**
```ts
{
  remitoId: string
  items: { productoId, productoNombre, cantidadEnviada, cantidadRecibida }[]
  observacion?: string
}
```

**Estado local:** un objeto por remito con las cantidades recibidas y la observación.

- [ ] **Step 1: Crear el archivo**

```tsx
"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, PackageCheck } from "lucide-react"
import type { RemitoLog } from "@/lib/logistica-types"

type RecepcionState = {
  cantidades: Record<string, number>
  observacion: string
  loading: boolean
}

function initRecepcion(remito: RemitoLog): RecepcionState {
  const cantidades: Record<string, number> = {}
  remito.items.forEach((item) => {
    cantidades[item.productoId] = item.cantidadEnviada
  })
  return { cantidades, observacion: "", loading: false }
}

export default function RecibirPedidoPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useData()
  const { toast } = useToast()
  const companySlug = params.companySlug as string

  const { remitosRecibidos, loading, confirmarRecepcion } = useLogistica(user)

  const [estados, setEstados] = useState<Record<string, RecepcionState>>({})

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  const remitosEnCamino = remitosRecibidos.filter((r) => r.estado === "en_camino")

  const getEstado = (remito: RemitoLog): RecepcionState =>
    estados[remito.id] ?? initRecepcion(remito)

  const setCantidad = (remitoId: string, productoId: string, value: number) => {
    setEstados((prev) => {
      const remito = remitosEnCamino.find((r) => r.id === remitoId)!
      const base = prev[remitoId] ?? initRecepcion(remito)
      return {
        ...prev,
        [remitoId]: {
          ...base,
          cantidades: { ...base.cantidades, [productoId]: Math.max(0, value) },
        },
      }
    })
  }

  const setObservacion = (remitoId: string, value: string) => {
    setEstados((prev) => {
      const remito = remitosEnCamino.find((r) => r.id === remitoId)!
      const base = prev[remitoId] ?? initRecepcion(remito)
      return { ...prev, [remitoId]: { ...base, observacion: value } }
    })
  }

  const setRemitoLoading = (remitoId: string, value: boolean) => {
    setEstados((prev) => {
      const remito = remitosEnCamino.find((r) => r.id === remitoId)!
      const base = prev[remitoId] ?? initRecepcion(remito)
      return { ...prev, [remitoId]: { ...base, loading: value } }
    })
  }

  const handleConfirmar = async (remito: RemitoLog) => {
    const estado = getEstado(remito)

    const items = remito.items.map((item) => ({
      productoId: item.productoId,
      productoNombre: item.productoNombre,
      cantidadEnviada: item.cantidadEnviada,
      cantidadRecibida: estado.cantidades[item.productoId] ?? item.cantidadEnviada,
    }))

    setRemitoLoading(remito.id, true)
    const result = await confirmarRecepcion({
      remitoId: remito.id,
      items,
      observacion: estado.observacion || undefined,
    })
    setRemitoLoading(remito.id, false)

    if (result.ok) {
      toast({ title: "Recepción confirmada", description: `Remito ${remito.numero} recibido correctamente` })
    } else {
      toast({ title: "Error", description: result.error ?? "No se pudo confirmar la recepción", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Recibir pedido</h1>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando remitos…</p>
        )}

        {!loading && remitosEnCamino.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <PackageCheck className="w-12 h-12" />
            <p className="text-sm text-center">
              No hay pedidos en camino hacia tu sucursal.
            </p>
          </div>
        )}

        {remitosEnCamino.map((remito) => {
          const estado = getEstado(remito)
          const hayFaltantes = remito.items.some(
            (item) => (estado.cantidades[item.productoId] ?? item.cantidadEnviada) < item.cantidadEnviada
          )

          return (
            <div
              key={remito.id}
              className="bg-white rounded-xl border border-[#ebebeb] mb-4 overflow-hidden"
            >
              {/* Encabezado remito */}
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{remito.origenNombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{remito.numero}</p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  en camino
                </span>
              </div>

              {/* Info */}
              <div className="px-4 py-2">
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  Ingresá cuánto recibiste. Si falta algo, se genera un pedido pendiente.
                </p>
              </div>

              {/* Items */}
              <div className="px-4 pb-2">
                {remito.items.map((item) => {
                  const recibido = estado.cantidades[item.productoId] ?? item.cantidadEnviada
                  const hayFaltante = recibido < item.cantidadEnviada

                  return (
                    <div
                      key={item.productoId}
                      className="flex items-center gap-3 py-2.5 border-t border-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{item.productoNombre}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Enviado: {item.cantidadEnviada}</p>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={recibido}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10)
                          if (!isNaN(v)) setCantidad(remito.id, item.productoId, v)
                        }}
                        className={`w-14 h-9 text-center text-sm font-semibold rounded-lg border bg-gray-50 outline-none focus:ring-2 focus:ring-[#1D9E75] ${
                          hayFaltante ? "border-red-400 text-red-600" : "border-gray-200 text-gray-800"
                        }`}
                      />
                      <span className={`text-xs w-6 ${hayFaltante ? "text-red-500" : "text-gray-400"}`}>
                        {hayFaltante ? "⚠" : ""}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Observaciones */}
              <div className="px-4 pb-3">
                <textarea
                  placeholder="Observaciones (opcional)…"
                  value={estado.observacion}
                  onChange={(e) => setObservacion(remito.id, e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-none outline-none focus:ring-2 focus:ring-[#1D9E75] text-gray-800 placeholder-gray-400"
                />
              </div>

              {/* Botón confirmar */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => handleConfirmar(remito)}
                  disabled={estado.loading}
                  className="w-full py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
                >
                  {estado.loading ? "Confirmando…" : "Confirmar recepción"}
                </button>
                {hayFaltantes && (
                  <p className="text-xs text-amber-600 text-center mt-2">
                    ⚠ Hay diferencias. Se creará un pedido por los faltantes.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar en navegador**

Navegar a `/pwa/TEST_SLUG/stock-console/recepcion`. Verificar:
- Remitos "en_camino" se muestran con inputs numéricos inicializados con `cantidadEnviada`
- Al bajar un valor, el input se pone en rojo con `⚠`
- Mensaje de advertencia de faltantes aparece debajo del botón
- Estado vacío cuando no hay remitos en camino

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit final**

```bash
git add "app/pwa/[companySlug]/stock-console/recepcion/page.tsx"
git commit -m "feat(pwa): pantalla Recibir pedido con confirmarRecepcion"
```

---

## Task 6: Verificación de integración final

**Files:** Sin cambios de código

- [ ] **Step 1: Build completo sin errores**

```bash
npm run build 2>&1 | tail -20
```

Esperado: sin errores de TypeScript ni de compilación. Warnings de ESLint son aceptables.

- [ ] **Step 2: Verificar flujo completo en navegador**

Con `npm run dev`:

1. Ir a `/pwa/SLUG/stock-console` → ver 4 cards
2. Tap "Contar stock" → ver chips + lista + contadores
3. Volver (`‹`) → volver al index
4. Tap "Ver y enviar pedido" → ver pedidos del día o estado vacío
5. Tap "Tomar y despachar" → ver pedidos activos o estado vacío
6. Tap "Recibir pedido" → ver remitos o estado vacío
7. Sin usuario (cerrar sesión) → cualquier subpantalla muestra LoginForm

- [ ] **Step 3: Verificar que la ruta antigua sigue navegando a la nueva pantalla**

El tab "Stock" del PwaShell apunta a `/pwa/[slug]/stock-console`. Verificar que llega a la nueva pantalla principal (las 4 cards) y no a `StockConsoleContent`.

- [ ] **Step 4: Commit de cierre**

```bash
git add -A
git commit -m "feat(pwa): Stock & Pedidos multi-pantalla completo"
```

---

## Notas para el implementador

- **No existe `no-scrollbar` en Tailwind por defecto.** Si el chip de grupos tiene scroll horizontal y aparece la barra, agregar esto en `globals.css`:
  ```css
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  ```
- **`userData` puede ser `undefined` brevemente** mientras carga. Los hooks manejan esto internamente; en los pages solo se usa para `locationName` (con fallback a `locationId`).
- **`crearRemito` descuenta stock del origen.** Si el usuario de despacho no tiene stock registrado en su ubicación para algún producto, el servicio lanza un error. El toast mostrará el mensaje del servicio.
- **El `PedidoFabrica.creadoEn`** puede ser `null` en pedidos muy viejos o con datos incompletos. La función `esDeHoy` ya maneja esto con try/catch devolviendo `false`.
