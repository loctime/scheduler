"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, Plus, Minus } from "lucide-react"
import type { Producto, EnlacePublico } from "@/lib/types"

interface EnlacePublicoFormProps {
  productos: Producto[]
  enlacePublico?: EnlacePublico
  onConfirmar: (productosDisponibles: EnlacePublico["productosDisponibles"]) => void
  loading?: boolean
  pedidoConfirmado?: boolean
}

export function EnlacePublicoForm({
  productos,
  enlacePublico,
  onConfirmar,
  loading = false,
  pedidoConfirmado = false,
}: EnlacePublicoFormProps) {
  const [productosDisponibles, setProductosDisponibles] = useState<
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string; completo?: boolean; listo?: boolean }>
  >(enlacePublico?.productosDisponibles || {})
  const [productosDisponiblesOriginales, setProductosDisponiblesOriginales] = useState<
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string; completo?: boolean; listo?: boolean }>
  >(enlacePublico?.productosDisponibles || {})
  const [observacionesHabilitadas, setObservacionesHabilitadas] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {}
      const productos = enlacePublico?.productosDisponibles
      if (productos) {
        Object.keys(productos).forEach((key) => {
          if (productos[key]?.observaciones) {
            initial[key] = true
          }
        })
      }
      return initial
    }
  )

  useEffect(() => {
    const productos = enlacePublico?.productosDisponibles
    if (productos) {
      setProductosDisponibles(productos)
      setProductosDisponiblesOriginales(productos)
      const habilitadas: Record<string, boolean> = {}
      Object.keys(productos).forEach((key) => {
        if (productos[key]?.observaciones) {
          habilitadas[key] = true
        }
      })
      setObservacionesHabilitadas(habilitadas)
    }
  }, [enlacePublico])

  // Detectar si hay cambios cuando el pedido está confirmado
  const hayCambios = pedidoConfirmado && JSON.stringify(productosDisponibles) !== JSON.stringify(productosDisponiblesOriginales)

  const toggleDisponible = (productoId: string) => {
    if (pedidoConfirmado && !hayCambios) {
      // Si es la primera edición después de confirmar, el modal se mostrará al intentar confirmar
    }
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        disponible: !prev[productoId]?.disponible,
        completo: prev[productoId]?.completo && !prev[productoId]?.disponible ? prev[productoId]?.completo : undefined,
        listo: prev[productoId]?.listo && !prev[productoId]?.disponible ? prev[productoId]?.listo : undefined,
      },
    }))
  }

  const updateCantidadEnviada = (productoId: string, cantidad: number) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        disponible: cantidad > 0,
        cantidadEnviada: cantidad >= 0 ? cantidad : undefined,
        completo: undefined,
        listo: cantidad > 0 ? prev[productoId]?.listo : undefined,
      },
    }))
  }

  const updateObservaciones = (productoId: string, observaciones: string) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        observaciones: observaciones || undefined,
      },
    }))
  }

  const toggleCompleto = (productoId: string, cantidadPedida: number, current?: { cantidadEnviada?: number }) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        disponible: true,
        completo: !prev[productoId]?.completo,
        // Al marcar completo, lo consideramos listo y seteamos cantidad pedida
        listo: !prev[productoId]?.completo ? true : prev[productoId]?.listo,
        cantidadEnviada: !prev[productoId]?.completo ? cantidadPedida : current?.cantidadEnviada,
      },
    }))
  }

  const toggleListo = (productoId: string) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        disponible: true,
        listo: !prev[productoId]?.listo,
        completo: prev[productoId]?.listo ? prev[productoId]?.completo : undefined,
      },
    }))
  }

  const incrementarCantidad = (productoId: string) => {
    const productoData = productosDisponibles[productoId] || {}
    const cantidadActual = productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0
    updateCantidadEnviada(productoId, cantidadActual + 1)
  }

  const decrementarCantidad = (productoId: string) => {
    const productoData = productosDisponibles[productoId] || {}
    const cantidadActual = productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0
    if (cantidadActual > 0) {
      updateCantidadEnviada(productoId, cantidadActual - 1)
    }
  }

  const toggleObservacionesHabilitadas = (productoId: string) => {
    setObservacionesHabilitadas((prev) => {
      const nuevoEstado = !prev[productoId]
      if (!nuevoEstado) {
        // Si se deshabilita, limpiar las observaciones
        updateObservaciones(productoId, "")
      }
      return {
        ...prev,
        [productoId]: nuevoEstado,
      }
    })
  }

  return (
    <div className="space-y-6">
      {pedidoConfirmado && (
        <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            ⚠️ Este pedido ya fue confirmado. Si editas las cantidades y confirmas, se cancelará el pedido anterior.
          </p>
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Productos del Pedido</h3>
          <p className="text-sm text-muted-foreground">
            Marca los productos disponibles y especifica la cantidad a enviar
          </p>
        </div>
        <div className="space-y-3">
          {productos
            .filter((producto) => {
              const cantidadPedida = (producto as any).cantidadPedida ?? 0
              return cantidadPedida > 0
            })
            .map((producto, index) => ({ producto, index }))
            .sort((a, b) => {
              const aData = productosDisponibles[a.producto.id] || {}
              const bData = productosDisponibles[b.producto.id] || {}
              const aDone = aData.completo || aData.listo
              const bDone = bData.completo || bData.listo
              if (aDone === bDone) return a.index - b.index
              return aDone ? 1 : -1
            })
            .map(({ producto }) => {
            const productoData = productosDisponibles[producto.id] || { disponible: false }
            const cantidadPedida = (producto as any).cantidadPedida ?? 0
            const completado = productoData.completo || productoData.listo

            return (
              <div
                key={producto.id}
                className={`rounded-lg border p-3 sm:p-4 space-y-3 ${completado ? "border-green-300 bg-green-50 dark:bg-green-950/30" : ""}`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <Checkbox
                    checked={!!productoData.listo}
                    onCheckedChange={() => toggleListo(producto.id)}
                    className="mt-0.5 sm:mt-0 h-5 w-5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Label className="text-base font-medium truncate">
                        {producto.nombre}
                      </Label>
                      <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        <span>
                          Pedida: {cantidadPedida} {producto.unidad || "unid"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={!!productoData.completo}
                            onCheckedChange={() => toggleCompleto(producto.id, cantidadPedida, productoData)}
                            className="h-4 w-4"
                          />
                          <span className="text-[11px] sm:text-xs">Completo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label htmlFor={`cantidad-${producto.id}`} className="text-xs sm:text-sm">
                        Cantidad a enviar
                      </Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => decrementarCantidad(producto.id)}
                          disabled={(productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0) === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id={`cantidad-${producto.id}`}
                          type="number"
                          min="0"
                          value={productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0}
                          onChange={(e) => {
                            const valor = e.target.value === "" ? 0 : parseInt(e.target.value) || 0
                            updateCantidadEnviada(producto.id, valor)
                          }}
                          placeholder={cantidadPedida.toString()}
                          className="text-sm text-center"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => incrementarCantidad(producto.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`habilitar-obs-${producto.id}`}
                          checked={!!observacionesHabilitadas[producto.id]}
                          onCheckedChange={() => toggleObservacionesHabilitadas(producto.id)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`habilitar-obs-${producto.id}`} className="text-xs sm:text-sm cursor-pointer">
                          Observaciones (opcional)
                        </Label>
                      </div>
                      {observacionesHabilitadas[producto.id] && (
                        <Textarea
                          id={`obs-${producto.id}`}
                          value={productoData.observaciones ?? ""}
                          onChange={(e) =>
                            updateObservaciones(producto.id, e.target.value)
                          }
                          placeholder="Notas sobre este producto..."
                          rows={1}
                          className="text-sm resize-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          onClick={() => {
            // Limpiar campos que no deben guardarse en Firebase (completo, listo)
            const productosDisponiblesLimpios = Object.entries(productosDisponibles).reduce((acc, [key, value]) => {
              acc[key] = {
                disponible: value.disponible,
                cantidadEnviada: value.cantidadEnviada,
                observaciones: value.observaciones,
              }
              return acc
            }, {} as Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>)
            
            onConfirmar(productosDisponiblesLimpios)
          }}
          disabled={loading}
          className="w-full sm:w-auto min-w-[150px]"
        >
          {loading ? (
            "Confirmando..."
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Confirmar Envío
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
