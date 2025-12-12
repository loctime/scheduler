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
  const [productosDisponibles, setProductosDisponibles] = useState<
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>
  >(enlacePublico?.productosDisponibles || {})
  const [observacionesHabilitadas, setObservacionesHabilitadas] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const productos = enlacePublico?.productosDisponibles
    if (productos) {
      setProductosDisponibles(productos)
      const habilitadas: Record<string, boolean> = {}
      Object.keys(productos).forEach((key) => {
        if (productos[key]?.observaciones) {
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

    onGenerarRemito(productosDisponibles)
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
    <div className="space-y-6">
      <div className="space-y-4">
        {productosFiltrados.map((producto) => {
          const cantidadPedida = (producto as any).cantidadPedida ?? 0
          const productoData = productosDisponibles[producto.id] || { disponible: false }
          const disponible = productoData.disponible
          const cantidadEnviada = productoData.cantidadEnviada ?? 0

          return (
            <div
              key={producto.id}
              id={`producto-${producto.id}`}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={disponible}
                      onCheckedChange={() => toggleDisponible(producto.id)}
                      disabled={!puedeGenerarRemito}
                    />
                    <Label className="text-base font-medium cursor-pointer">
                      {producto.nombre}
                    </Label>
                  </div>
                  <div className="ml-7 mt-1 text-sm text-muted-foreground">
                    Pedido: {cantidadPedida} {producto.unidad || "U"}
                  </div>
                </div>
              </div>

              {disponible && (
                <div className="ml-7 space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Cantidad a enviar:</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateCantidad(producto.id, cantidadEnviada - 1)}
                        disabled={cantidadEnviada <= 0 || !puedeGenerarRemito}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={cantidadEnviada}
                        onChange={(e) => updateCantidad(producto.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center"
                        disabled={!puedeGenerarRemito}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateCantidad(producto.id, cantidadEnviada + 1)}
                        disabled={!puedeGenerarRemito}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {producto.unidad || "U"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
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
                      className="min-h-[80px]"
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
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleConfirmar} size="lg">
            <Check className="h-4 w-4 mr-2" />
            Generar remito
          </Button>
        </div>
      )}

      {!puedeGenerarRemito && pedido.estado !== "processing" && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Acepta el pedido primero para poder generar el remito
        </div>
      )}
    </div>
  )
}

