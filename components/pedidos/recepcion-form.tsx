"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package, Check, AlertTriangle } from "lucide-react"
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

const estadosProducto = [
  { value: "ok", label: "OK" },
  { value: "danado", label: "Dañado" },
  { value: "vencido", label: "Vencido" },
  { value: "faltante", label: "Faltante" },
] as const

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
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <h3 className="text-lg font-semibold">
            Control de Recepción {esParcial && "(Parcial)"}
          </h3>
          {productosEnviados.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({productosEnviados.length} {productosEnviados.length === 1 ? "producto" : "productos"})
            </span>
          )}
        </div>

        <div className="space-y-3">
          {productosEnviados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
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
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label className="text-base font-medium">
                      {producto.productoNombre}
                    </Label>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>
                        <span className="font-medium">Pedida:</span> {producto.cantidadPedida}
                      </span>
                      <span>
                        <span className="font-medium">Enviada:</span> {producto.cantidadEnviada}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`cantidad-${producto.productoId}`}>
                      Cantidad recibida
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
                    />
                  </div>

                  <div>
                    <Label htmlFor={`estado-${producto.productoId}`}>
                      Estado
                    </Label>
                    <Select
                      value={data.estado}
                      onValueChange={(value: any) =>
                        updateProducto(producto.productoId, "estado", value)
                      }
                    >
                      <SelectTrigger id={`estado-${producto.productoId}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {estadosProducto.map((estado) => (
                          <SelectItem key={estado.value} value={estado.value}>
                            {estado.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`obs-${producto.productoId}`}>
                    Observaciones
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
                    placeholder="Notas sobre este producto..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={data.esDevolucion}
                    onCheckedChange={(checked) =>
                      updateProducto(
                        producto.productoId,
                        "esDevolucion",
                        checked
                      )
                    }
                  />
                  <Label className="text-sm">
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
          className="min-w-[150px]"
        >
          {loading ? (
            "Registrando..."
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Confirmar Recepción
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
