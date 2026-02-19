"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useData } from "@/contexts/data-context"
import { useStockConsole } from "@/hooks/use-stock-console"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { PwaNumericInput } from "@/components/pwa/pwa-numeric-input"
import { Check, X, Package, ArrowLeft, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserStatusMenu } from "@/components/pwa/UserStatusMenu"
import { PwaViewerBadge } from "@/components/pwa/PwaViewerBadge"
import { esModoPack, getCantidadPorPack, unidadesSignedToPacksFloor, packsSignedToUnidades } from "@/lib/unidades-utils"
import { ejecutarPedidoEngine } from "@/lib/pedido-engine"

/** Abrevia el nombre para vista móvil si supera 15 caracteres; si no, lo deja igual. */
function abbreviateProductName(nombre: string): string {
  if (nombre.length <= 15) return nombre
  const skipWords = new Set(["de", "y", "en", "con"])
  return nombre
    .split(/\s+/)
    .map((word) => {
      if (skipWords.has(word.toLowerCase())) return word
      if (/^\d+(x\d+)?$/i.test(word)) return word
      if (word.length <= 3) return word
      return word.slice(0, 3) + "."
    })
    .join(" ")
}

interface StockConsoleContentProps {
  companySlug?: string
}

export function StockConsoleContent({ companySlug }: StockConsoleContentProps = {}) {
  const { user, userData } = useData()
  const { toast } = useToast()

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
  const { state, pedidos, productos, stockActual, movimientosPendientes, totalIngresos, totalEgresos, setSelectedPedidoId, incrementarCantidad, decrementarCantidad, setCantidad, limpiarCantidades, confirmarMovimientos, setStockReal } = stockConsole

  // Cache del pedido-engine para generar texto cuando sea necesario
  const resultadoEngine = useMemo(() => {
    const selectedPedido = pedidos.find(p => p.id === state.selectedPedidoId)
    if (!selectedPedido) return null
    
    return ejecutarPedidoEngine({
      pedido: {
        nombre: selectedPedido.nombre,
        formatoSalida: selectedPedido.formatoSalida || "{nombre}: {cantidad} {unidad}",
        mensajePrevio: selectedPedido.mensajePrevio,
      },
      productos,
      stockActual,
      ajustesPedido: {}, // Stock console no tiene ajustes manuales
      calcularPedido: (stockMinimo: number, stockActualProducto?: number) => {
        // Stock console usa cantidades manuales, no stockMinimo
        return state.cantidades[selectedPedido.id] || 0
      },
    })
  }, [state.selectedPedidoId, pedidos, productos, stockActual, state.cantidades])

  const [mode, setMode] = useState<"work" | "control">("work")

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
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn(
              "text-xs font-medium hidden sm:inline",
              isPWA ? "text-red-800" : "text-white/90"
            )}>
              {mode === "work" ? "Modo Work" : "Modo Control"}
            </span>
            <Switch
              checked={mode === "control"}
              onCheckedChange={() => setMode(m => m === "work" ? "control" : "work")}
              className={cn(
                "scale-90 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-blue-500",
                isPWA && "data-[state=unchecked]:bg-red-400 data-[state=checked]:bg-green-600"
              )}
              aria-label={mode === "work" ? "Cambiar a modo control" : "Cambiar a modo work"}
            />
          </div>
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
              const unidadLabel = producto.unidadBase || producto.unidad || "U"

              // Modo work: input = cantidad a pedir. Modo control: input = stock real.
              const isControl = mode === "control"
              const displayValue = isControl
                ? (vm === "pack" ? unidadesSignedToPacksFloor(producto, stock) : stock)
                : (vm === "pack" ? unidadesSignedToPacksFloor(producto, cantidad) : cantidad)
              const packsDisplay = isPackProduct ? unidadesSignedToPacksFloor(producto, Math.abs(isControl ? stock : cantidad)) : 0
              const equivalenciaText = isControl
                ? (vm === "pack" ? `${displayValue} pack${Math.abs(displayValue) !== 1 ? "s" : ""} (${stock} ${unidadLabel})` : isPackProduct ? `${stock} ${unidadLabel} (${packsDisplay} pack${packsDisplay !== 1 ? "s" : ""})` : `${stock} ${unidadLabel}`)
                : (vm === "pack" ? `${displayValue} pack${Math.abs(displayValue) !== 1 ? "s" : ""} (${cantidad} ${unidadLabel})` : isPackProduct ? `${cantidad} ${unidadLabel} (${packsDisplay} pack${packsDisplay !== 1 ? "s" : ""})` : `${cantidad} ${unidadLabel}`)

              // Efecto "llenado de agua" solo en modo work
              const maxFillRef = 15
              const fillPct = !isControl && cantidad > 0
                ? Math.min(100, (cantidad / maxFillRef) * 100)
                : !isControl && cantidad < 0
                  ? Math.min(100, (Math.abs(cantidad) / Math.max(stock, 1)) * 100)
                  : 0
              const fillColor = !isControl && cantidad > 0 ? "sky" : !isControl && cantidad < 0 ? "violet" : null

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

                  {/* Izquierda: info del producto en 3 filas */}
                  <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center p-3 gap-1">
                    {/* Fila 1: solo nombre (abreviado en móvil), puede continuar abajo sin truncar */}
                    <p className="text-base font-semibold text-gray-900 min-w-0 break-words">
                      <span className="lg:hidden">{abbreviateProductName(producto.nombre)}</span>
                      <span className="hidden lg:inline">{producto.nombre}</span>
                    </p>

                    {/* Fila 2: Stock (izq) y Unidad/Pack solo si el producto tiene pack */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700">Stock: {stock}</span>
                      {isPackProduct ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setVisualModeFor(producto.id, "unidad")}
                            className={cn(
                              "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                              vm === "unidad" ? "bg-gray-300 text-gray-900" : "text-gray-600 hover:bg-gray-100"
                            )}
                          >
                            U
                          </button>
                          <span className="text-gray-400 text-xs">/</span>
                          <button
                            type="button"
                            onClick={() => setVisualModeFor(producto.id, "pack")}
                            className={cn(
                              "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                              vm === "pack" ? "bg-gray-300 text-gray-900" : "text-gray-600 hover:bg-gray-100"
                            )}
                          >
                            Pack
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{unidadLabel}</span>
                      )}
                    </div>

                    {/* Fila 3: Min y equivalencia (1 pack (12u) / 12 u (1 pack)) en la misma línea */}
                    <div className="flex items-center gap-2 flex-wrap text-sm text-gray-700">
                      <span className="font-medium">Mín: {stockMinimo}</span>
                      {(isControl ? stock !== 0 : cantidad !== 0) && (
                        <span className="text-gray-600">{equivalenciaText}</span>
                      )}
                    </div>
                  </div>

                  {/* Derecha: [-] número [+] en fila */}
                  <div className="relative z-10 flex items-center gap-1.5 pr-1.5 shrink-0">
                    {isControl ? (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-full transition-transform active:scale-95 border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-400"
                          onClick={() => setStockReal(producto.id, Math.max(0, stock - delta))}
                          disabled={stock <= 0 || state.loading}
                        >
                          <Minus className="h-5 w-5" strokeWidth={2.5} />
                        </Button>
                        <PwaNumericInput
                          id={`input-${producto.id}`}
                          step={1}
                          value={displayValue}
                          onChange={(e) => {
                            e.stopPropagation()
                            const raw = parseInt(e.target.value, 10)
                            if (isNaN(raw) || raw < 0) return
                            const unidades = vm === "pack" ? packsSignedToUnidades(producto, raw) : raw
                            setStockReal(producto.id, unidades)
                          }}
                          className="h-11 w-12 text-center text-xl font-bold tabular-nums border border-gray-200/80 rounded-lg bg-gray-50/50 focus-visible:ring-2 focus-visible:ring-gray-300/50 p-0"
                          placeholder="0"
                          disabled={state.loading}
                          allowNegative={false}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-full transition-transform active:scale-95 border-sky-400 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-500"
                          onClick={() => setStockReal(producto.id, stock + delta)}
                          disabled={state.loading}
                        >
                          <Plus className="h-5 w-5" strokeWidth={2.5} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-full transition-transform active:scale-95 border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-400"
                          onClick={() => decrementarCantidad(producto.id, delta)}
                          disabled={cantidad <= cantidadMinimaPermitida || state.loading}
                        >
                          <Minus className="h-5 w-5" strokeWidth={2.5} />
                        </Button>
                        <PwaNumericInput
                          id={`input-${producto.id}`}
                          step={1}
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
                          allowNegative
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
                      </>
                    )}
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

        {/* Panel de resumen y acciones — solo en modo work */}
        {mode === "work" && (
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
              {/* Botón para generar texto del pedido usando pedido-engine */}
              {resultadoEngine && (
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(resultadoEngine.texto)
                      toast({
                        title: "Texto copiado",
                        description: "El texto del pedido se ha copiado al portapapeles",
                      })
                    } catch {
                      toast({
                        title: "Error",
                        description: "No se pudo copiar el texto",
                        variant: "destructive",
                      })
                    }
                  }}
                  disabled={state.loading}
                  className={`h-10 ${isPWA ? "px-2 text-xs" : "px-4"}`}
                >
                  <Package className={`w-4 h-4 ${isPWA ? "mr-1" : "mr-2"}`} />
                  Copiar Texto
                </Button>
              )}
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
        )}
      </div>
    </>
  )
}
