"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check } from "lucide-react"
import type { Recepcion } from "@/lib/types"

interface RecepcionFormProps {
  productosEnviados: Array<{
    productoId: string
    productoNombre: string
    cantidadPedida: number
    cantidadEnviada: number
  }>
  onConfirmar: (recepcion: Omit<Recepcion, "id" | "createdAt">) => void
  loading?: boolean
  esParcial?: boolean
}

export function RecepcionForm({
  productosEnviados,
  onConfirmar,
  loading = false,
  esParcial = false,
}: RecepcionFormProps) {
  const [productosRecepcion, setProductosRecepcion] = useState<
    Record<
      string,
      {
        cantidadRecibida: number
        observaciones?: string
        esDevolucion?: boolean
      }
    >
  >({})

  useEffect(() => {
    // Inicializar con cantidades enviadas
    const inicial: typeof productosRecepcion = {}
    productosEnviados.forEach((p) => {
      inicial[p.productoId] = {
        cantidadRecibida: p.cantidadEnviada,
        esDevolucion: false,
      }
    })
    setProductosRecepcion(inicial)
  }, [productosEnviados])

  const updateProducto = (
    productoId: string,
    field: keyof typeof productosRecepcion[string],
    value: any
  ) => {
    setProductosRecepcion((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        [field]: value,
      },
    }))
  }

  const handleConfirmar = () => {
    const productos = productosEnviados.map((p) => {
      const data = productosRecepcion[p.productoId] || {
        cantidadRecibida: p.cantidadEnviada,
        esDevolucion: false,
      }
      // Construir objeto de producto, eliminando campos undefined
      const producto: any = {
        productoId: p.productoId,
        productoNombre: p.productoNombre,
        cantidadEnviada: p.cantidadEnviada,
        cantidadRecibida: data.cantidadRecibida,
        estado: "ok", // Siempre "ok" por defecto
        esDevolucion: data.esDevolucion || false,
      }
      // Solo incluir observaciones si tiene valor
      if (data.observaciones && data.observaciones.trim()) {
        producto.observaciones = data.observaciones
      }
      return producto
    })

    onConfirmar({
      pedidoId: "", // Se completará en el componente padre
      fecha: new Date(),
      productos,
      esParcial: esParcial || false,
      completada: true,
      userId: "", // Se completará en el componente padre
    })
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header compacto */}
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 shrink-0" />
        <h3 className="text-sm font-semibold">
          Control de Recepción {esParcial && "(Parcial)"}
        </h3>
        {productosEnviados.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {productosEnviados.length} {productosEnviados.length === 1 ? "producto" : "productos"}
          </span>
        )}
      </div>

      <div className="space-y-2 md:space-y-3">
        {productosEnviados.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No hay productos para recibir
          </div>
        ) : (
          productosEnviados.map((producto) => {
            const data = productosRecepcion[producto.productoId] || {
              cantidadRecibida: producto.cantidadEnviada,
              esDevolucion: false,
            }

            return (
              <div
                key={producto.productoId}
                className="rounded-lg border p-2.5 md:p-3 space-y-2.5 md:space-y-3"
              >
                {/* Nombre del producto y cantidad pedida */}
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium truncate flex-1">
                    {producto.productoNombre}
                  </Label>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    Pedida: <span className="font-medium">{producto.cantidadPedida}</span>
                  </span>
                </div>

                {/* Enviada y Recibido en la misma línea - Mobile First */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`enviada-${producto.productoId}`} className="text-xs">
                      Enviada
                    </Label>
                    <Input
                      id={`enviada-${producto.productoId}`}
                      type="number"
                      value={producto.cantidadEnviada}
                      disabled
                      className="bg-muted text-sm h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`cantidad-${producto.productoId}`} className="text-xs">
                      Recibido
                    </Label>
                    <Input
                      id={`cantidad-${producto.productoId}`}
                      type="number"
                      min="0"
                      value={data.cantidadRecibida}
                      onChange={(e) =>
                        updateProducto(
                          producto.productoId,
                          "cantidadRecibida",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="text-sm h-9"
                    />
                  </div>
                </div>

                {/* Comentario */}
                <div className="space-y-1">
                  <Label htmlFor={`obs-${producto.productoId}`} className="text-xs">
                    Comentario
                  </Label>
                  <Textarea
                    id={`obs-${producto.productoId}`}
                    value={data.observaciones || ""}
                    onChange={(e) =>
                      updateProducto(
                        producto.productoId,
                        "observaciones",
                        e.target.value
                      )
                    }
                    placeholder="Nota breve..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                {/* Checkbox de devolución */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Checkbox
                    id={`devolucion-${producto.productoId}`}
                    checked={data.esDevolucion}
                    onCheckedChange={(checked) =>
                      updateProducto(
                        producto.productoId,
                        "esDevolucion",
                        checked
                      )
                    }
                  />
                  <Label 
                    htmlFor={`devolucion-${producto.productoId}`}
                    className="text-xs cursor-pointer"
                  >
                    Marcar como devolución
                  </Label>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Botón de confirmación - Mobile First */}
      <div className="flex justify-end gap-2 pt-3 border-t">
        <Button
          onClick={handleConfirmar}
          disabled={loading}
          className="w-full md:w-auto min-w-[140px] h-10"
        >
          {loading ? (
            "Registrando..."
          ) : (
            <>
              <Check className="h-4 w-4 mr-1.5" />
              <span>Confirmar Recepción</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
