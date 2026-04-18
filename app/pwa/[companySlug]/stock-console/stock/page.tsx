"use client"

import { useParams, useRouter } from "next/navigation"
import { useData } from "@/contexts/data-context"
import { useStockConsole } from "@/hooks/use-stock-console"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { getStockStatus, type StockStatus } from "@/lib/stock-status"
import { ChevronLeft, Package } from "lucide-react"

export default function ContarStockPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useData()
  const companySlug = params.companySlug as string

  // Hook always called before any return (Rules of Hooks)
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
        <h1 className="text-base font-medium text-gray-900 flex-1">Contar stock</h1>
        {selectedPedido && (
          <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
            {selectedPedido.nombre}
          </span>
        )}
      </div>

      {/* Group chips */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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

      {/* Product list */}
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

              {/* Counter */}
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
          onClick={confirmarMovimientos}
          disabled={state.loading || !hayMovimientos}
          className="flex-1 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
        >
          {state.loading ? "Guardando…" : "Guardar stock"}
        </button>
      </div>
    </div>
  )
}

function StockBadge({ status }: { status: StockStatus }) {
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
