"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, Plus, Minus } from "lucide-react"
import type { Producto, EnlacePublico, Pedido } from "@/lib/types"

interface FabricaPedidoFormProps {
  productos: Producto[]
  enlacePublico?: EnlacePublico
  onGenerarRemito: (productosDisponibles: EnlacePublico["productosDisponibles"]) => void
  pedido: Pedido
  puedeGenerarRemito: boolean
}

export function FabricaPedidoForm({
  productos,
  enlacePublico,
  onGenerarRemito,
  pedido,
  puedeGenerarRemito,
}: FabricaPedidoFormProps) {
  // Convertir array a Record si es necesario
  const productosDisponiblesInicial = enlacePublico?.productosDisponibles
    ? Array.isArray(enlacePublico.productosDisponibles)
      ? enlacePublico.productosDisponibles.reduce((acc, item) => {
          acc[item.productoId] = {
            disponible: item.disponible,
            cantidadEnviada: item.cantidadEnviar,
          }
          return acc
        }, {} as Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>)
      : enlacePublico.productosDisponibles
    : {}

  const [productosDisponibles, setProductosDisponibles] = useState<      
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>                                                            
  >(productosDisponiblesInicial)
  const [observacionesHabilitadas, setObservacionesHabilitadas] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const productos = enlacePublico?.productosDisponibles
    if (productos) {
      // Convertir array a Record si es necesario
      const productosRecord = Array.isArray(productos)
        ? productos.reduce((acc, item) => {
            acc[item.productoId] = {
              disponible: item.disponible,
              cantidadEnviada: item.cantidadEnviar,
            }
            return acc
          }, {} as Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>)
        : productos
      setProductosDisponibles(productosRecord)
      const habilitadas: Record<string, boolean> = {}
      Object.keys(productosRecord).forEach((key) => {
        if (productosRecord[key]?.observaciones) {
          habilitadas[key] = true
        }
      })
      setObservacionesHabilitadas(habilitadas)
    }
  }, [enlacePublico])

  const toggleDisponible = (productoId: string) => {
    setProductosDisponibles((prev) => {
      const current = prev[productoId] || { disponible: false }
      return {
        ...prev,
        [productoId]: {
          ...current,
          disponible: !current.disponible,
          cantidadEnviada: !current.disponible ? (current.cantidadEnviada || 0) : 0,
        },
      }
    })
  }

  const updateCantidad = (productoId: string, cantidad: number) => {
    setProductosDisponibles((prev) => {
      const current = prev[productoId] || { disponible: false }
      return {
        ...prev,
        [productoId]: {
          ...current,
          cantidadEnviada: Math.max(0, cantidad),
        },
      }
    })
  }

  const toggleObservaciones = (productoId: string) => {
    setObservacionesHabilitadas((prev) => ({
      ...prev,
      [productoId]: !prev[productoId],
    }))
    
    if (!observacionesHabilitadas[productoId]) {
      setProductosDisponibles((prev) => ({
        ...prev,
        [productoId]: {
          ...(prev[productoId] || { disponible: false }),
          observaciones: "",
        },
      }))
    } else {
      setProductosDisponibles((prev) => {
        const updated = { ...prev }
        if (updated[productoId]) {
          delete updated[productoId].observaciones
        }
        return updated
      })
    }
  }

  const updateObservaciones = (productoId: string, observaciones: string) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...(prev[productoId] || { disponible: false }),
        observaciones,
      },
    }))
  }

  const handleConfirmar = () => {
    // Validar que haya al menos un producto disponible con cantidad > 0
    const productosConCantidad = Object.entries(productosDisponibles).filter(
      ([_, data]) => data.disponible && (data.cantidadEnviada ?? 0) > 0
    )

    if (productosConCantidad.length === 0) {
      alert("Debes marcar al menos un producto como disponible y especificar la cantidad a enviar")
      return
    }

    // Convertir Record a array
    const productosDisponiblesArray = Object.entries(productosDisponibles).map(([productoId, data]) => ({
      productoId,
      disponible: data.disponible,
      cantidadEnviar: data.cantidadEnviada,
    }))
    onGenerarRemito(productosDisponiblesArray)
  }

  // Filtrar productos que tienen cantidadPedida > 0
  const productosFiltrados = productos.filter((p) => {
    const cantidadPedida = (p as any).cantidadPedida ?? 0
    return cantidadPedida > 0
  })

  if (productosFiltrados.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No hay productos en este pedido</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 sm:space-y-4">
        {productosFiltrados.map((producto) => {
          const cantidadPedida = (producto as any).cantidadPedida ?? 0
          const productoData = productosDisponibles[producto.id] || { disponible: false }
          const disponible = productoData.disponible
          const cantidadEnviada = productoData.cantidadEnviada ?? 0

          return (
            <div
              key={producto.id}
              id={`producto-${producto.id}`}
              className="border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Checkbox
                      checked={disponible}
                      onCheckedChange={() => toggleDisponible(producto.id)}
                      disabled={!puedeGenerarRemito}
                      className="shrink-0"
                    />
                    <Label className="text-sm sm:text-base font-medium cursor-pointer break-words">
                      {producto.nombre}
                    </Label>
                  </div>
                  <div className="ml-6 sm:ml-7 mt-1 text-xs sm:text-sm text-muted-foreground">
                    Pedido: {cantidadPedida} {producto.unidad || "U"}
                  </div>
                </div>
              </div>

              {disponible && (
                <div className="ml-6 sm:ml-7 space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Label className="text-xs sm:text-sm shrink-0">Cantidad a enviar:</Label>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                        onClick={() => updateCantidad(producto.id, cantidadEnviada - 1)}
                        disabled={cantidadEnviada <= 0 || !puedeGenerarRemito}
                      >
                        <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={cantidadEnviada}
                        onChange={(e) => updateCantidad(producto.id, parseInt(e.target.value) || 0)}
                        className="w-16 sm:w-20 text-center text-sm h-7 sm:h-8"
                        disabled={!puedeGenerarRemito}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                        onClick={() => updateCantidad(producto.id, cantidadEnviada + 1)}
                        disabled={!puedeGenerarRemito}
                      >
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <span className="text-xs sm:text-sm text-muted-foreground shrink-0">
                        {producto.unidad || "U"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                      onClick={() => toggleObservaciones(producto.id)}
                      disabled={!puedeGenerarRemito}
                    >
                      {observacionesHabilitadas[producto.id] ? "Ocultar" : "Agregar"} observaciones
                    </Button>
                  </div>

                  {observacionesHabilitadas[producto.id] && (
                    <Textarea
                      placeholder="Observaciones sobre este producto..."
                      value={productoData.observaciones || ""}
                      onChange={(e) => updateObservaciones(producto.id, e.target.value)}
                      className="min-h-[60px] sm:min-h-[80px] text-sm"
                      disabled={!puedeGenerarRemito}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {puedeGenerarRemito && (
        <div className="flex justify-end pt-3 sm:pt-4 border-t">
          <Button onClick={handleConfirmar} size="lg" className="w-full sm:w-auto">
            <Check className="h-4 w-4 mr-2" />
            Generar remito
          </Button>
        </div>
      )}

      {!puedeGenerarRemito && pedido.estado !== "processing" && (
        <div className="text-center py-3 sm:py-4 text-xs sm:text-sm text-muted-foreground">
          Acepta el pedido primero para poder generar el remito
        </div>
      )}
    </div>
  )
}

