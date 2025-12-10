"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, AlertTriangle, Plus, Minus } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import type { Recepcion } from "@/lib/types"

interface RecepcionFormProps {
  productosEnviados: Array<{
    productoId: string
    productoNombre: string
    cantidadPedida: number
    cantidadEnviada: number
    observacionesEnvio?: string
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
  
  // Estado para observaciones generales
  const [observacionesGenerales, setObservacionesGenerales] = useState("")
  
  // Estado para controlar si el comentario está habilitado
  const [comentariosHabilitados, setComentariosHabilitados] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Inicializar con cantidades enviadas
    const inicial: typeof productosRecepcion = {}
    const habilitados: Record<string, boolean> = {}
    productosEnviados.forEach((p) => {
      inicial[p.productoId] = {
        cantidadRecibida: p.cantidadEnviada,
        esDevolucion: false,
      }
      // Si hay observaciones previas, habilitar el comentario
      if (inicial[p.productoId].observaciones) {
        habilitados[p.productoId] = true
      }
    })
    setProductosRecepcion(inicial)
    setComentariosHabilitados(habilitados)
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
      
      // Si se marca devolución, validar que recibido != enviada y habilitar comentario
      if (field === "esDevolucion" && value === true) {
        const cantidadRecibida = currentData.cantidadRecibida
        if (cantidadRecibida === producto.cantidadEnviada) {
          // No permitir marcar devolución si recibido = enviada
          return prev
        }
        // Habilitar comentario automáticamente cuando se marca como devolución
        setComentariosHabilitados(prev => ({
          ...prev,
          [productoId]: true
        }))
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
      // Validar que productoNombre esté presente y sea válido
      const nombreProducto = (p.productoNombre && p.productoNombre.trim()) || "Producto sin nombre"
      
      const producto: any = {
        productoId: p.productoId,
        productoNombre: nombreProducto,
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
      observaciones: observacionesGenerales.trim() || undefined,
      userId: "", // Se completará en el componente padre
    })
  }

  // Función para incrementar cantidad recibida
  const incrementarCantidad = (productoId: string) => {
    const producto = productosEnviados.find(p => p.productoId === productoId)
    if (!producto) return
    const data = productosRecepcion[productoId] || { cantidadRecibida: producto.cantidadEnviada }
    updateProducto(productoId, "cantidadRecibida", data.cantidadRecibida + 1)
  }

  // Función para decrementar cantidad recibida
  const decrementarCantidad = (productoId: string) => {
    const producto = productosEnviados.find(p => p.productoId === productoId)
    if (!producto) return
    const data = productosRecepcion[productoId] || { cantidadRecibida: producto.cantidadEnviada }
    if (data.cantidadRecibida > 0) {
      updateProducto(productoId, "cantidadRecibida", data.cantidadRecibida - 1)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-foreground mb-1">
          Control de Recepción {esParcial && "(Parcial)"}
        </h3>
        {productosEnviados.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {productosEnviados.length} {productosEnviados.length === 1 ? "producto" : "productos"}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {productosEnviados.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No hay productos para recibir
          </div>
        ) : (
          productosEnviados.map((producto) => {
            const data = productosRecepcion[producto.productoId] || {
              cantidadRecibida: producto.cantidadEnviada,
              esDevolucion: false,
            }

            // Determinar el color del recuadro según la cantidad
            let cardClassName = "rounded-xl border-2 p-4 space-y-4 transition-all "
            if (data.cantidadRecibida > producto.cantidadEnviada) {
              // Rojo si recibido > enviado
              cardClassName += "border-red-500 bg-red-50 dark:bg-red-950/40 shadow-md"
            } else if (data.cantidadRecibida === producto.cantidadEnviada && data.cantidadRecibida > 0) {
              // Azul si recibido = enviado
              cardClassName += "border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-md"
            } else if (data.cantidadRecibida < producto.cantidadEnviada) {
              // Amarillo si recibido < enviado
              cardClassName += "border-amber-500 bg-amber-50 dark:bg-amber-950/40 shadow-md"
            } else {
              cardClassName += "border-border bg-card shadow-sm hover:shadow-md"
            }

            return (
              <div
                key={producto.productoId}
                className={cardClassName}
              >
                {/* Línea superior: Producto • Pedida: X • Enviada: X */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base font-semibold text-foreground truncate">
                      {producto.productoNombre}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      Pedida: <span className="font-medium text-foreground">{producto.cantidadPedida}</span>
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      Enviada: <span className="font-medium text-foreground">{producto.cantidadEnviada}</span>
                    </span>
                  </div>
                </div>

                {/* Observaciones del envío (si existen) */}
                {producto.observacionesEnvio && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 p-3">
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                          Comentario del envío:
                        </p>
                        <p className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap break-words">
                          {producto.observacionesEnvio}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Campo numérico con botones para Recibido */}
                <div>
                  <Label htmlFor={`cantidad-${producto.productoId}`} className="text-sm font-medium text-foreground mb-2 block">
                    Cantidad recibida
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0 border-2 hover:bg-muted"
                      onClick={() => decrementarCantidad(producto.productoId)}
                      disabled={data.cantidadRecibida === 0}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
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
                      className="text-lg font-semibold text-center h-12 border-2 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0 border-2 hover:bg-muted"
                      onClick={() => incrementarCantidad(producto.productoId)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Información de diferencia */}
                {data.cantidadRecibida !== producto.cantidadEnviada && (
                  <div className="rounded-lg border-2 p-2.5">
                    {data.cantidadRecibida < producto.cantidadEnviada && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <p className="text-xs text-foreground">
                          Faltan <span className="font-semibold">{producto.cantidadEnviada - data.cantidadRecibida}</span> unidades
                          {data.esDevolucion && " • Se devolverán las unidades faltantes"}
                        </p>
                      </div>
                    )}
                    {data.cantidadRecibida > producto.cantidadEnviada && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                        <p className="text-xs text-foreground">
                          Excedente de <span className="font-semibold">{data.cantidadRecibida - producto.cantidadEnviada}</span> unidades
                          {data.esDevolucion && " • Se devolverán los productos excedentes"}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Checkbox de comentario */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id={`habilitar-obs-${producto.productoId}`}
                      checked={comentariosHabilitados[producto.productoId] || data.esDevolucion}
                      onCheckedChange={(checked) => {
                        if (data.esDevolucion) return // No permitir desmarcar si es devolución
                        const isChecked = checked === true
                        setComentariosHabilitados(prev => ({
                          ...prev,
                          [producto.productoId]: isChecked
                        }))
                        if (!isChecked) {
                          updateProducto(producto.productoId, "observaciones", "")
                        }
                      }}
                      disabled={data.esDevolucion}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`habilitar-obs-${producto.productoId}`} className="text-sm font-medium text-foreground cursor-pointer">
                      Agregar comentario
                      {data.esDevolucion && " *"}
                    </Label>
                  </div>
                  {(comentariosHabilitados[producto.productoId] || data.esDevolucion) && (
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
                      placeholder={data.esDevolucion ? "Comentario obligatorio para devolución..." : "Escribe un comentario..."}
                      rows={2}
                      className={cn(
                        "text-sm resize-none border-2",
                        data.esDevolucion && !data.observaciones?.trim() && "border-amber-500 focus:border-amber-500"
                      )}
                      required={data.esDevolucion}
                    />
                  )}
                  {data.esDevolucion && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                      * Comentario obligatorio para devoluciones
                    </p>
                  )}
                </div>

                {/* Checkbox de devolución */}
                <div className="flex items-center gap-2 pt-1 border-t">
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
                    className="h-4 w-4"
                  />
                  <Label 
                    htmlFor={`devolucion-${producto.productoId}`}
                    className={cn(
                      "text-sm font-medium cursor-pointer",
                      !puedeMarcarDevolucion(producto, data) && "text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    Marcar como devolución
                  </Label>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Observaciones generales */}
      <div className="space-y-3 pt-3 border-t-2">
        <div className="space-y-1">
          <Label htmlFor="observaciones-generales" className="text-sm font-medium text-foreground">
            Observaciones Generales
          </Label>
          <Textarea
            id="observaciones-generales"
            value={observacionesGenerales}
            onChange={(e) => setObservacionesGenerales(e.target.value)}
            placeholder="Observaciones adicionales sobre la recepción..."
            rows={3}
            className="text-sm resize-none border-2"
          />
        </div>
      </div>

      {/* Botón de confirmación */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-background border-t-2 mt-6">
        <Button
          onClick={handleConfirmar}
          disabled={loading}
          className="w-full h-12 text-base font-semibold shadow-lg"
          size="lg"
        >
          {loading ? (
            "Registrando..."
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Confirmar Recepción
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
