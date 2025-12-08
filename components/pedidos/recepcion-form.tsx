"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, X, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Recepcion, EnlacePublico } from "@/lib/types"

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
        estado: "ok" | "danado" | "vencido" | "faltante"
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
        estado: "ok",
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
        estado: "ok" as const,
        esDevolucion: false,
      }
      // Construir objeto de producto, eliminando campos undefined
      const producto: any = {
        productoId: p.productoId,
        productoNombre: p.productoNombre,
        cantidadEnviada: p.cantidadEnviada,
        cantidadRecibida: data.cantidadRecibida,
        estado: data.estado,
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

  console.log("RecepcionForm - productosEnviados:", productosEnviados)
  console.log("RecepcionForm - cantidad de productos:", productosEnviados.length)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 sm:h-5 sm:w-5" />
            <h3 className="text-base sm:text-lg font-semibold">
              Control de Recepción {esParcial && "(Parcial)"}
            </h3>
          </div>
          {productosEnviados.length > 0 && (
            <span className="text-xs sm:text-sm text-muted-foreground">
              ({productosEnviados.length} {productosEnviados.length === 1 ? "producto" : "productos"})
            </span>
          )}
        </div>

        <div className="space-y-3 sm:space-y-4">
          {productosEnviados.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-sm sm:text-base text-muted-foreground">
              No hay productos para recibir
            </div>
          ) : (
            productosEnviados.map((producto) => {
            const data = productosRecepcion[producto.productoId] || {
              cantidadRecibida: producto.cantidadEnviada,
              estado: "ok" as const,
              esDevolucion: false,
            }

            return (
              <div
                key={producto.productoId}
                className="rounded-lg border p-3 sm:p-4 space-y-3 sm:space-y-4"
              >
                {/* Nombre y cantidad pedida en la misma línea */}
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-base sm:text-lg font-medium truncate">
                    {producto.productoNombre}
                  </Label>
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    <span className="font-medium">Pedida:</span> {producto.cantidadPedida}
                  </span>
                </div>

                {/* Enviada */}
                <div className="grid grid-cols-1 sm:grid-cols-[140px] gap-3 sm:gap-4 items-start">
                  <div className="space-y-1">
                    <Label htmlFor={`enviada-${producto.productoId}`} className="text-xs sm:text-sm">
                      Enviada
                    </Label>
                    <Input
                      id={`enviada-${producto.productoId}`}
                      type="number"
                      value={producto.cantidadEnviada}
                      disabled
                      className="bg-muted text-sm"
                    />
                  </div>
                </div>

                {/* Recibido, comentario y estado en la misma línea */}
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3 sm:gap-4 items-start">
                  <div className="space-y-1">
                    <Label htmlFor={`cantidad-${producto.productoId}`} className="text-xs sm:text-sm">
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
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`obs-${producto.productoId}`} className="text-xs sm:text-sm">
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
                      rows={1}
                      className="text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm block mb-1.5">Estado</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={data.estado === "ok" ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateProducto(producto.productoId, "estado", "ok")}
                        className={cn(
                          "flex-1 sm:flex-initial min-w-[44px] h-9 sm:h-10",
                          data.estado === "ok" && "bg-green-600 hover:bg-green-700 text-white"
                        )}
                        aria-label="Estado OK"
                      >
                        <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant={data.estado === "danado" ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateProducto(producto.productoId, "estado", "danado")}
                        className={cn(
                          "flex-1 sm:flex-initial min-w-[44px] h-9 sm:h-10",
                          data.estado === "danado" && "bg-red-600 hover:bg-red-700 text-white"
                        )}
                        aria-label="Estado con error"
                      >
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant={data.estado === "faltante" ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateProducto(producto.productoId, "estado", "faltante")}
                        className={cn(
                          "flex-1 sm:flex-initial min-w-[44px] h-9 sm:h-10",
                          data.estado === "faltante" && "bg-yellow-600 hover:bg-yellow-700 text-white"
                        )}
                        aria-label="Estado parcial"
                      >
                        <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Checkbox de devolución */}
                <div className="flex items-center gap-2 pt-1">
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
                    className="text-xs sm:text-sm cursor-pointer"
                  >
                    Marcar como devolución
                  </Label>
                </div>
              </div>
            )
            })
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          onClick={handleConfirmar}
          disabled={loading}
          className="w-full sm:w-auto min-w-[150px]"
        >
          {loading ? (
            "Registrando..."
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Confirmar Recepción</span>
              <span className="sm:hidden">Confirmar</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
