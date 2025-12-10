"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, Plus, Minus, CheckCircle2 } from "lucide-react"
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
    <div className="space-y-4">
      {pedidoConfirmado && (
        <div className="rounded-lg border-2 border-amber-600 bg-amber-50 dark:bg-amber-950/40 p-3 shadow-sm">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            ⚠️ Este pedido ya fue confirmado. Si editas las cantidades y confirmas, se cancelará el pedido anterior.
          </p>
        </div>
      )}
      
      <div className="space-y-3">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">Productos del Pedido</h3>
          <p className="text-sm text-muted-foreground">
            Especifica la cantidad a enviar de cada producto
          </p>
        </div>

        <div className="space-y-4">
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
            const cantidadActual = productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0

            // Determinar el color del recuadro según la cantidad
            // Prioridad: Rojo (supera) > Verde (completado) > Azul (igual) > Normal
            let cardClassName = "rounded-xl border-2 p-4 space-y-4 transition-all "
            if (cantidadActual > cantidadPedida) {
              // Rojo tiene prioridad aunque esté marcado como listo
              cardClassName += "border-red-500 bg-red-50 dark:bg-red-950/40 shadow-md"
            } else if (completado) {
              cardClassName += "border-green-500 bg-green-50 dark:bg-green-950/40 shadow-md"
            } else if (cantidadActual === cantidadPedida && cantidadActual > 0) {
              cardClassName += "border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-md"
            } else {
              cardClassName += "border-border bg-card shadow-sm hover:shadow-md"
            }

            return (
              <div
                key={producto.id}
                className={cardClassName}
              >
                {/* Línea superior: Producto >>> Pedida >>> Botón Listo */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base font-semibold text-foreground truncate">
                      {producto.nombre}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      Pedida: <span className="font-medium text-foreground">{cantidadPedida}</span> {producto.unidad || "unid"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={productoData.listo ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleListo(producto.id)}
                    className={`shrink-0 ${productoData.listo ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Listo
                  </Button>
                </div>

                {/* Campo numérico con botones + Botón TILDE (Completo) */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0 border-2 hover:bg-muted"
                      onClick={() => decrementarCantidad(producto.id)}
                      disabled={cantidadActual === 0}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <Input
                      id={`cantidad-${producto.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={cantidadActual}
                      onChange={(e) => {
                        const valor = e.target.value === "" ? 0 : parseInt(e.target.value) || 0
                        updateCantidadEnviada(producto.id, valor)
                      }}
                      placeholder={cantidadPedida.toString()}
                      className="text-lg font-semibold text-center h-12 border-2 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0 border-2 hover:bg-muted"
                      onClick={() => incrementarCantidad(producto.id)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  <Button
                    type="button"
                    variant={productoData.completo ? "default" : "outline"}
                    size="icon"
                    className={`h-12 w-12 shrink-0 border-2 ${
                      productoData.completo 
                        ? "bg-green-600 hover:bg-green-700 border-green-600" 
                        : "hover:bg-muted"
                    }`}
                    onClick={() => toggleCompleto(producto.id, cantidadPedida, productoData)}
                    title="Marcar como completo"
                  >
                    <CheckCircle2 className="h-6 w-6" />
                  </Button>
                </div>

                {/* Checkbox de comentario */}
                <div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`habilitar-obs-${producto.id}`}
                      checked={!!observacionesHabilitadas[producto.id]}
                      onCheckedChange={() => toggleObservacionesHabilitadas(producto.id)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`habilitar-obs-${producto.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                      Agregar comentario
                    </Label>
                  </div>
                  {observacionesHabilitadas[producto.id] && (
                    <Textarea
                      id={`obs-${producto.id}`}
                      value={productoData.observaciones ?? ""}
                      onChange={(e) =>
                        updateObservaciones(producto.id, e.target.value)
                      }
                      placeholder="Escribe un comentario..."
                      rows={2}
                      className="text-sm resize-none border-2 mt-2"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Botón de confirmar */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-background border-t-2 mt-6">
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
          className="w-full h-12 text-base font-semibold shadow-lg"
          size="lg"
        >
          {loading ? (
            "Confirmando..."
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Confirmar Envío
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
