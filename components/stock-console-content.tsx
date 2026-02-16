"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useData } from "@/contexts/data-context"
import { useStockConsole } from "@/hooks/use-stock-console"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, X, Package, ArrowLeft, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserStatusMenu } from "@/components/pwa/UserStatusMenu"
import { PwaViewerBadge } from "@/components/pwa/PwaViewerBadge"
import { esModoPack, getCantidadPorPack, unidadesSignedToPacksFloor, packsSignedToUnidades } from "@/lib/unidades-utils"

interface StockConsoleContentProps {
  companySlug?: string
}

export function StockConsoleContent({ companySlug }: StockConsoleContentProps = {}) {
  const { user, userData } = useData()

  // Validar permisos antes de renderizar la página
  const tienePermisoPedidos = userData?.permisos?.paginas?.includes("pedidos")

  // Detectar si estamos corriendo como PWA
  const [isPWA, setIsPWA] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsPWA(
        window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as any).standalone === true
      )
    }
  }, [])

  // Hook siempre llamado antes de cualquier return (regla de hooks de React)
  const stockConsole = useStockConsole(user)
  const { state, pedidos, productos, stockActual, movimientosPendientes, totalIngresos, totalEgresos, setSelectedPedidoId, incrementarCantidad, decrementarCantidad, setCantidad, limpiarCantidades, confirmarMovimientos } = stockConsole

  // visualMode: solo visual, no persiste. Debe ir ANTES de cualquier return (Rules of Hooks)
  const [visualMode, setVisualMode] = useState<Record<string, "unidad" | "pack">>({})
  const getVisualMode = useCallback((productoId: string, producto: { modoCompra?: "unidad" | "pack"; cantidadPorPack?: number }) =>
    visualMode[productoId] ?? (esModoPack(producto) ? "pack" : "unidad"),
  [visualMode])
  const setVisualModeFor = useCallback((productoId: string, mode: "unidad" | "pack") => {
    setVisualMode(prev => ({ ...prev, [productoId]: mode }))
  }, [])
  useEffect(() => {
    const productIds = new Set(productos.map(p => p.id))
    setVisualMode(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(id => { if (!productIds.has(id)) delete next[id] })
      return next
    })
  }, [productos])

  // Si no tiene permisos, mostrar mensaje de acceso denegado (después de todos los hooks)
  if (!tienePermisoPedidos) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Acceso Denegado</h2>
            <p className="text-red-600">
              No tienes permisos para acceder a Stock Console.
              <br />
              Esta función requiere el permiso "pedidos".
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>

      <div className={`min-h-screen bg-gray-100 ${isPWA ? "pb-20" : "pb-24"}`}>
        {/* Header simple — tema rojo en PWA */}
        <div className={`p-4 shadow-lg flex items-center gap-3 ${isPWA ? "bg-red-100 text-red-900 border-b border-red-200" : "bg-blue-500 text-white"}`}>
          {companySlug ? (
            <Link
              href={`/pwa/${companySlug}/home`}
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/20 active:bg-white/30 transition-colors shrink-0"
              aria-label="Volver al home"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
          ) : null}
          <h1 className="text-xl font-bold flex-1">Stock Rápido</h1>
          <div className={cn(
            "flex items-center gap-1",
            isPWA ? "[&_button]:text-red-900 [&_button]:hover:bg-red-200 [&_button]:hover:text-red-900" : "[&_button]:text-white [&_button]:hover:bg-white/20 [&_button]:hover:text-white [&_.bg-green-500]:border-blue-500"
          )}>
            <PwaViewerBadge companySlug={companySlug} variant={isPWA ? "default" : "light-on-dark"} />
            <UserStatusMenu />
          </div>
        </div>

        {/* Selector de Pedido (compacto) — máx. 2 filas + scroll horizontal */}
        <div className="bg-white border-b">
          <div className="p-4">
            <div className="overflow-x-auto overflow-y-hidden max-h-[4.75rem]">
              <div className="flex flex-wrap gap-2 w-max min-w-full max-h-[4.75rem]">
                
                {pedidos.map((pedido) => (
                  <button
                    key={pedido.id}
                    onClick={() => setSelectedPedidoId(pedido.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                      state.selectedPedidoId === pedido.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {pedido.nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Productos — cards compactas, número protagonista */}
        {state.selectedPedidoId && productos.length > 0 && (
          <div className="p-3 space-y-2">
            {productos.map((producto) => {
              const cantidad = state.cantidades[producto.id] || 0
              const stock = stockActual[producto.id] || 0
              const stockMinimo = producto.stockMinimo || 0
              const isStockBajo = stock < stockMinimo
              const stockDisponible = stock
              const cantidadMinimaPermitida = -stockDisponible
              const vm = getVisualMode(producto.id, producto)
              const isPackProduct = esModoPack(producto)
              const delta = vm === "pack" ? getCantidadPorPack(producto) : 1
              const displayValue = vm === "pack" ? unidadesSignedToPacksFloor(producto, cantidad) : cantidad
              const unidadLabel = producto.unidadBase || producto.unidad || "U"
              const packsDisplay = isPackProduct ? unidadesSignedToPacksFloor(producto, Math.abs(cantidad)) : 0
              const equivalenciaText = vm === "pack"
                ? `${displayValue} pack${Math.abs(displayValue) !== 1 ? "s" : ""} (${cantidad} ${unidadLabel})`
                : isPackProduct
                  ? `${cantidad} ${unidadLabel} (${packsDisplay} pack${packsDisplay !== 1 ? "s" : ""})`
                  : `${cantidad} ${unidadLabel}`

              // Efecto "llenado de agua": % de fill según cantidad (max referencia: 15)
              const maxFillRef = 15
              const fillPct = cantidad > 0
                ? Math.min(100, (cantidad / maxFillRef) * 100)
                : cantidad < 0
                  ? Math.min(100, (Math.abs(cantidad) / Math.max(stock, 1)) * 100)
                  : 0
              const fillColor = cantidad > 0 ? "sky" : cantidad < 0 ? "violet" : null

              return (
                <div
                  key={producto.id}
                  className={cn(
                    "relative rounded-2xl border border-gray-200/80 bg-white shadow-sm active:shadow-md transition-all flex overflow-hidden",
                    isStockBajo && "border-amber-400"
                  )}
                >
                  {/* Capa de fill "como agua" con ondas */}
                  {fillColor && fillPct > 0 && (
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 transition-all duration-300 ease-out pointer-events-none overflow-visible",
                        fillColor === "sky" && "bg-sky-200/50",
                        fillColor === "violet" && "bg-violet-200/50"
                      )}
                      style={{
                        height: `${fillPct}%`,
                        maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath fill='white' d='M0,100 L0,8 Q10,22 20,8 T40,8 T60,8 T80,8 T100,8 L100,100 Z'/%3E%3C/svg%3E")`,
                        WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath fill='white' d='M0,100 L0,8 Q10,22 20,8 T40,8 T60,8 T80,8 T100,8 L100,100 Z'/%3E%3C/svg%3E")`,
                        maskSize: "100% 100%",
                        maskPosition: "bottom",
                        maskRepeat: "no-repeat",
                        WebkitMaskSize: "100% 100%",
                        WebkitMaskPosition: "bottom",
                        WebkitMaskRepeat: "no-repeat",
                      }}
                    />
                  )}

                  {/* Izquierda: info del producto */}
                  <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-base font-semibold truncate text-gray-900">{producto.nombre}</p>
                      {isPackProduct && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setVisualModeFor(producto.id, "unidad")}
                            className={cn(
                              "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                              vm === "unidad" ? "bg-gray-200 text-gray-800" : "text-gray-500 hover:bg-gray-100"
                            )}
                          >
                            Unidad
                          </button>
                          <span className="text-gray-300">/</span>
                          <button
                            type="button"
                            onClick={() => setVisualModeFor(producto.id, "pack")}
                            className={cn(
                              "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                              vm === "pack" ? "bg-gray-200 text-gray-800" : "text-gray-500 hover:bg-gray-100"
                            )}
                          >
                            Pack
                          </button>
                        </div>
                      )}
                      {!isPackProduct && (
                        <span className="text-[11px] text-gray-400 uppercase tracking-wide">{unidadLabel}</span>
                      )}
                    </div>

                    {/* Stock arriba, Mín debajo */}
                    <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-gray-500">
                      <span>Stock: {stock}</span>
                      <span>Mín: {stockMinimo}{isStockBajo && " · Bajo mínimo"}</span>
                    </div>
                    {/* Equivalencia */}
                    {cantidad !== 0 && (
                      <span className="text-[10px] text-gray-400 mt-0.5 block">{equivalenciaText}</span>
                    )}
                  </div>

                  {/* Derecha: [-] número [+] en fila */}
                  <div className="relative z-10 flex items-center gap-1.5 pr-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 rounded-full transition-transform active:scale-95 border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-400"
                      onClick={() => decrementarCantidad(producto.id, delta)}
                      disabled={cantidad <= cantidadMinimaPermitida || state.loading}
                    >
                      <Minus className="h-5 w-5" strokeWidth={2.5} />
                    </Button>
                    <Input
                      id={`input-${producto.id}`}
                      type="number"
                      step="1"
                      value={displayValue}
                      onChange={(e) => {
                        e.stopPropagation()
                        const raw = parseInt(e.target.value, 10)
                        if (isNaN(raw)) return
                        const unidades = vm === "pack" ? packsSignedToUnidades(producto, raw) : raw
                        setCantidad(producto.id, unidades)
                      }}
                      className="h-11 w-12 text-center text-xl font-bold tabular-nums border border-gray-200/80 rounded-lg bg-gray-50/50 focus-visible:ring-2 focus-visible:ring-gray-300/50 p-0"
                      placeholder="0"
                      disabled={state.loading}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 rounded-full transition-transform active:scale-95 border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-500"
                      onClick={() => incrementarCantidad(producto.id, delta)}
                      disabled={state.loading}
                    >
                      <Plus className="h-5 w-5" strokeWidth={2.5} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Estado vacío */}
        {(!state.selectedPedidoId || productos.length === 0) && (
          <div className="p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {state.selectedPedidoId ? "No hay productos" : "Selecciona un pedido"}
            </h3>
            <p className="text-gray-600 text-lg">
              {state.selectedPedidoId
                ? "Este pedido no tiene productos cargados."
                : "Elige un pedido para comenzar a registrar movimientos de stock."}
            </p>
          </div>
        )}

        {/* Panel de resumen y acciones */}
        <div className={`fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 z-50 ${isPWA ? "p-2" : "p-3"}`}>
          <div className={`max-w-md mx-auto flex items-center justify-between ${isPWA ? "gap-1" : ""}`}>
            <Button
              variant="outline"
              onClick={limpiarCantidades}
              disabled={state.loading}
              className={`h-10 ${isPWA ? "px-2 text-xs" : "px-4"}`}
            >
              <X className={`w-4 h-4 ${isPWA ? "mr-1" : "mr-2"}`} />
              Limpiar
            </Button>
            <div className={`flex items-center ${isPWA ? "gap-0.5" : "gap-1"}`}>
              <span className={`font-bold text-red-600 ${isPWA ? "text-lg" : "text-2xl"}`}>
                -{totalEgresos}
              </span>
              <span className={`text-gray-500 ${isPWA ? "text-sm" : "text-xl"}`}>|</span>
              <span className={`font-bold text-green-600 ${isPWA ? "text-lg" : "text-2xl"}`}>
                +{totalIngresos}
              </span>
            </div>
            <Button
              onClick={confirmarMovimientos}
              disabled={state.loading || movimientosPendientes.length === 0}
              className={`h-10 bg-blue-600 hover:bg-blue-700 ${isPWA ? "px-2 text-xs" : "px-4"}`}
            >
              <Check className={`w-4 h-4 ${isPWA ? "mr-1" : "mr-2"}`} />
              {state.loading ? "Procesando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
