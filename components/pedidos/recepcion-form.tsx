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
      return {
        productoId: p.productoId,
        productoNombre: p.productoNombre,
        cantidadEnviada: p.cantidadEnviada,
        cantidadRecibida: data.cantidadRecibida,
        estado: data.estado,
        observaciones: data.observaciones,
        esDevolucion: data.esDevolucion || false,
      }
    })

    onConfirmar({
      pedidoId: "", // Se completará en el componente padre
      fecha: new Date(),
      productos,
      esParcial,
      completada: true,
      userId: "", // Se completará en el componente padre
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <h3 className="text-lg font-semibold">
            Control de Recepción {esParcial && "(Parcial)"}
          </h3>
        </div>

        <div className="space-y-3">
          {productosEnviados.map((producto) => {
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
                  <div>
                    <Label className="text-base font-medium">
                      {producto.productoNombre}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Cantidad enviada: {producto.cantidadEnviada}
                    </p>
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
          })}
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
