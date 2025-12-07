"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check } from "lucide-react"
import type { Producto, EnlacePublico } from "@/lib/types"

interface EnlacePublicoFormProps {
  productos: Producto[]
  enlacePublico?: EnlacePublico
  onConfirmar: (productosDisponibles: EnlacePublico["productosDisponibles"]) => void
  loading?: boolean
}

export function EnlacePublicoForm({
  productos,
  enlacePublico,
  onConfirmar,
  loading = false,
}: EnlacePublicoFormProps) {
  const [productosDisponibles, setProductosDisponibles] = useState<
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>
  >(enlacePublico?.productosDisponibles || {})

  useEffect(() => {
    if (enlacePublico?.productosDisponibles) {
      setProductosDisponibles(enlacePublico.productosDisponibles)
    }
  }, [enlacePublico])

  const toggleDisponible = (productoId: string) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        disponible: !prev[productoId]?.disponible,
      },
    }))
  }

  const updateCantidadEnviada = (productoId: string, cantidad: number) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        disponible: true,
        cantidadEnviada: cantidad > 0 ? cantidad : undefined,
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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Productos del Pedido</h3>
        <div className="space-y-3">
          {productos.map((producto) => {
            const productoData = productosDisponibles[producto.id] || { disponible: false }
            const cantidadPedida = producto.stockMinimo || 0

            return (
              <div
                key={producto.id}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={productoData.disponible}
                    onCheckedChange={() => toggleDisponible(producto.id)}
                  />
                  <div className="flex-1">
                    <Label className="text-base font-medium">
                      {producto.nombre}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Cantidad pedida: {cantidadPedida} {producto.unidad || "unidades"}
                    </p>
                  </div>
                </div>

                {productoData.disponible && (
                  <div className="ml-8 space-y-3">
                    <div>
                      <Label htmlFor={`cantidad-${producto.id}`}>
                        Cantidad a enviar
                      </Label>
                      <Input
                        id={`cantidad-${producto.id}`}
                        type="number"
                        min="0"
                        value={productoData.cantidadEnviada || cantidadPedida}
                        onChange={(e) =>
                          updateCantidadEnviada(
                            producto.id,
                            parseInt(e.target.value) || 0
                          )
                        }
                        placeholder={cantidadPedida.toString()}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`obs-${producto.id}`}>
                        Observaciones (opcional)
                      </Label>
                      <Textarea
                        id={`obs-${producto.id}`}
                        value={productoData.observaciones || ""}
                        onChange={(e) =>
                          updateObservaciones(producto.id, e.target.value)
                        }
                        placeholder="Notas sobre este producto..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          onClick={() => onConfirmar(productosDisponibles)}
          disabled={loading}
          className="min-w-[150px]"
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
