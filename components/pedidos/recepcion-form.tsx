"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import type { Recepcion } from "@/lib/types"

interface RecepcionFormProps {
  productosEnviados: Array<{
    productoId: string
    productoNombre: string
    cantidadPedida: number
    cantidadEnviada: number
  }>
  onConfirmar: (recepcion: Omit<Recepcion, "id" | "createdAt">) => void | Promise<void>
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
    setProductosRecepcion((prev) => {
      const producto = productosEnviados.find(p => p.productoId === productoId)
      if (!producto) return prev
      
      const currentData = prev[productoId] || {
        cantidadRecibida: producto.cantidadEnviada,
        esDevolucion: false,
      }
      
      // Si se desmarca devolución, limpiar comentario si era obligatorio
      if (field === "esDevolucion" && value === false) {
        return {
          ...prev,
          [productoId]: {
            ...currentData,
            [field]: value,
          },
        }
      }
      
      // Si se marca devolución, validar que recibido != enviada
      if (field === "esDevolucion" && value === true) {
        const cantidadRecibida = currentData.cantidadRecibida
        if (cantidadRecibida === producto.cantidadEnviada) {
          // No permitir marcar devolución si recibido = enviada
          return prev
        }
      }
      
      return {
        ...prev,
        [productoId]: {
          ...currentData,
          [field]: value,
        },
      }
    })
  }
  
  // Calcular cantidad a devolver
  const calcularCantidadDevolucion = (producto: typeof productosEnviados[0], data: typeof productosRecepcion[string]) => {
    if (!data.esDevolucion) return 0
    const diferencia = producto.cantidadEnviada - data.cantidadRecibida
    if (diferencia > 0) {
      // Faltante: devolver lo que falta
      return diferencia
    } else if (diferencia < 0) {
      // Excedente: devolver el excedente
      return Math.abs(diferencia)
    }
    return 0
  }
  
  // Validar si se puede marcar como devolución
  const puedeMarcarDevolucion = (producto: typeof productosEnviados[0], data: typeof productosRecepcion[string]) => {
    return data.cantidadRecibida !== producto.cantidadEnviada
  }
  
  // Validar formulario antes de confirmar
  const validarFormulario = (): string | null => {
    for (const producto of productosEnviados) {
      const data = productosRecepcion[producto.productoId] || {
        cantidadRecibida: producto.cantidadEnviada,
        esDevolucion: false,
      }
      
      // Si está marcado como devolución, debe tener comentario
      if (data.esDevolucion && (!data.observaciones || !data.observaciones.trim())) {
        return `El producto "${producto.productoNombre}" está marcado como devolución y requiere un comentario obligatorio.`
      }
    }
    return null
  }

  const handleConfirmar = async () => {
    // Validar formulario
    const error = validarFormulario()
    if (error) {
      // Lanzar error para que el componente padre lo maneje
      throw new Error(error)
    }
    
    const productos = productosEnviados.map((p) => {
      const data = productosRecepcion[p.productoId] || {
        cantidadRecibida: p.cantidadEnviada,
        esDevolucion: false,
      }
      
      // Calcular cantidad a devolver
      const cantidadDevolucion = calcularCantidadDevolucion(p, data)
      
      // Construir objeto de producto (sin campos undefined)
      const producto: any = {
        productoId: p.productoId,
        productoNombre: p.productoNombre,
        cantidadEnviada: p.cantidadEnviada,
        cantidadRecibida: data.cantidadRecibida,
        estado: "ok", // Siempre "ok" por defecto
        esDevolucion: data.esDevolucion || false,
      }
      
      // Solo incluir cantidadDevolucion si es mayor a 0
      if (cantidadDevolucion > 0) {
        producto.cantidadDevolucion = cantidadDevolucion
      }
      
      // Comentario es obligatorio si hay devolución
      if (data.esDevolucion) {
        producto.observaciones = data.observaciones?.trim() || ""
      } else if (data.observaciones && data.observaciones.trim()) {
        producto.observaciones = data.observaciones.trim()
      }
      
      return producto
    })

    await onConfirmar({
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
                    placeholder={data.esDevolucion ? "Comentario obligatorio para devolución..." : "Nota breve..."}
                    rows={2}
                    className={cn(
                      "text-sm resize-none",
                      data.esDevolucion && !data.observaciones?.trim() && "border-amber-500 focus:border-amber-500"
                    )}
                    required={data.esDevolucion}
                  />
                </div>

                {/* Información de devolución y advertencias */}
                {data.cantidadRecibida !== producto.cantidadEnviada && (
                  <div className="space-y-1.5 pt-1">
                    {data.cantidadRecibida < producto.cantidadEnviada && (
                      <Alert className="py-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <AlertDescription className="text-xs">
                          Faltan {producto.cantidadEnviada - data.cantidadRecibida} unidades. 
                          {data.esDevolucion && " Se devolverán las unidades faltantes."}
                        </AlertDescription>
                      </Alert>
                    )}
                    {data.cantidadRecibida > producto.cantidadEnviada && (
                      <Alert className="py-2 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                          Excedente de {data.cantidadRecibida - producto.cantidadEnviada} unidades.
                          {data.esDevolucion && " Se devolverán los productos excedentes (no se sumarán al stock)."}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Checkbox de devolución */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Checkbox
                    id={`devolucion-${producto.productoId}`}
                    checked={data.esDevolucion}
                    disabled={!puedeMarcarDevolucion(producto, data)}
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
                    className={cn(
                      "text-xs cursor-pointer",
                      !puedeMarcarDevolucion(producto, data) && "text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    Marcar como devolución
                    {data.esDevolucion && " *"}
                  </Label>
                </div>
                
                {/* Mensaje de comentario obligatorio */}
                {data.esDevolucion && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    * Comentario obligatorio para devoluciones
                  </div>
                )}
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
