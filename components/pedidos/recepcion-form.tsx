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
import { esModoPack, getCantidadPorPack, packsToUnidades, unidadesToPacksFloor } from "@/lib/unidades-utils"
import { validarRecepcion, calcularCantidadDevolucion } from "@/src/domain/pedidos/recepcionRules"
import { prepararRecepcion } from "@/src/domain/pedidos/prepararRecepcion"

interface RecepcionFormProps {
  productosEnviados: Array<{
    productoId: string
    productoNombre: string
    cantidadPedida: number
    cantidadEnviada: number
    observacionesEnvio?: string
    modoCompra?: "unidad" | "pack"
    cantidadPorPack?: number
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
      
      // Si se marca devolución, habilitar comentario automáticamente
      if (field === "esDevolucion" && value === true) {
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
  
  // Estado para errores de validación del dominio
  const [erroresValidacion, setErroresValidacion] = useState<Array<{productoId: string, mensaje: string}>>([])

  const handleConfirmar = async () => {
    // Validar productos pack: cantidadRecibida debe ser múltiplo de cantidadPorPack
    const erroresPack: Array<{ productoId: string; mensaje: string }> = []
    productosEnviados.forEach((p) => {
      if (esModoPack(p)) {
        const data = productosRecepcion[p.productoId]
        if (data && data.cantidadRecibida > 0) {
          const qty = getCantidadPorPack(p)
          if (data.cantidadRecibida % qty !== 0) {
            erroresPack.push({
              productoId: p.productoId,
              mensaje: `${p.productoNombre}: La cantidad recibida (${data.cantidadRecibida}) debe ser múltiplo de ${qty} (1 pack). Recibí packs completos.`,
            })
          }
        }
      }
    })
    if (erroresPack.length > 0) {
      setErroresValidacion(erroresPack)
      throw new Error(erroresPack.map((e) => e.mensaje).join(". "))
    }

    // Convertir al formato esperado por el dominio
    const recepcionInput: Record<string, { productoId: string, cantidadRecibida: number, esDevolucion?: boolean, observaciones?: string }> = {}
    
    Object.entries(productosRecepcion).forEach(([productoId, data]) => {
      recepcionInput[productoId] = {
        productoId,
        cantidadRecibida: data.cantidadRecibida,
        esDevolucion: data.esDevolucion || false,
        observaciones: data.observaciones
      }
    })

    // Usar función del dominio para preparar recepción
    const resultado = prepararRecepcion(productosEnviados, recepcionInput)
    
    if (!resultado.ok) {
      setErroresValidacion(resultado.errores)
      throw new Error(resultado.errores.map(e => e.mensaje).join(". "))
    }
    
    setErroresValidacion([])

    await onConfirmar({
      pedidoId: "", // Se completará en el componente padre
      fecha: new Date(),
      ownerId: "", // Se completará en el componente padre
      productos: resultado.productos,
      esParcial: esParcial || false,
      completada: true,
      observaciones: observacionesGenerales.trim() || undefined,
      userId: "", // Se completará en el componente padre
    })
  }

  // Función para incrementar cantidad recibida (+1 unidad, o +1 pack si modoCompra es pack)
  const incrementarCantidad = (productoId: string) => {
    const producto = productosEnviados.find(p => p.productoId === productoId)
    if (!producto) return
    const data = productosRecepcion[productoId] || { cantidadRecibida: producto.cantidadEnviada }
    const incremento = esModoPack(producto) ? getCantidadPorPack(producto) : 1
    updateProducto(productoId, "cantidadRecibida", data.cantidadRecibida + incremento)
  }

  // Función para decrementar cantidad recibida (-1 unidad, o -1 pack si modoCompra es pack)
  const decrementarCantidad = (productoId: string) => {
    const producto = productosEnviados.find(p => p.productoId === productoId)
    if (!producto) return
    const data = productosRecepcion[productoId] || { cantidadRecibida: producto.cantidadEnviada }
    const decremento = esModoPack(producto) ? getCantidadPorPack(producto) : 1
    if (data.cantidadRecibida >= decremento) {
      updateProducto(productoId, "cantidadRecibida", data.cantidadRecibida - decremento)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">
          Control de Recepción {esParcial && "(Parcial)"}
        </h3>
        {productosEnviados.length > 0 && (
          <p className="text-xs sm:text-sm text-muted-foreground">
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
            if (producto.cantidadEnviada === 0) {
              // Estilo especial para productos con cantidad 0
              if (producto.observacionesEnvio) {
                // Si tiene comentario, destacar más (borde más grueso y color más visible)
                cardClassName += "border-2 border-purple-400 bg-purple-50 dark:bg-purple-950/30 shadow-md border-dashed"
              } else {
                // Sin comentario, estilo más sutil pero visible
                cardClassName += "border-2 border-gray-300 bg-gray-50 dark:bg-gray-900/30 shadow-sm border-dashed opacity-75"
              }
            } else if (data.cantidadRecibida > producto.cantidadEnviada) {
              // Rojo si recibido > enviado
              cardClassName += "border-red-500 bg-red-50 dark:bg-red-950/40 shadow-md"
            } else if (data.cantidadRecibida === producto.cantidadEnviada && data.cantidadRecibida > 0) {
              // Azul si recibido = enviado (y ambos > 0)
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
                {/* Nombre del producto */}
                <div className="mb-3">
                  <span className="text-base sm:text-lg font-bold text-foreground">
                    {producto.productoNombre}
                  </span>
                </div>

                {/* Primera fila: Labels y botón + */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Pedido
                  </Label>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Enviado
                  </Label>
                  <div className="flex items-center justify-end gap-2">
                    <Label htmlFor={`cantidad-${producto.productoId}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Recibido
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 border-2 hover:bg-muted p-0"
                      onClick={() => incrementarCantidad(producto.productoId)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Segunda fila: Cantidades */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                  <div className="text-2xl sm:text-3xl font-bold text-foreground leading-none">
                    {producto.cantidadPedida}
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 leading-none">
                    {producto.cantidadEnviada}
                  </div>
                  <div className="flex items-center justify-end">
                    {esModoPack(producto) ? (
                      <>
                        <Input
                          id={`cantidad-${producto.productoId}`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          value={unidadesToPacksFloor(producto, data.cantidadRecibida)}
                          onChange={(e) => {
                            const packs = parseInt(e.target.value, 10) || 0
                            const unidades = packsToUnidades(producto, Math.max(0, packs))
                            updateProducto(producto.productoId, "cantidadRecibida", unidades)
                          }}
                          className="text-2xl sm:text-3xl font-bold text-center h-auto border-2 w-20 sm:w-24 px-1 py-1"
                        />
                        <span className="text-xs text-muted-foreground ml-1 self-center">
                          packs ({data.cantidadRecibida} u)
                        </span>
                      </>
                    ) : (
                      <Input
                        id={`cantidad-${producto.productoId}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={data.cantidadRecibida}
                        onChange={(e) =>
                          updateProducto(
                            producto.productoId,
                            "cantidadRecibida",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="text-2xl sm:text-3xl font-bold text-center h-auto border-2 w-20 sm:w-24 px-1 py-1"
                      />
                    )}
                    {data.cantidadRecibida !== producto.cantidadEnviada && (
                      <div className="flex items-center gap-0.5 ml-2">
                        {data.cantidadRecibida < producto.cantidadEnviada && (
                          <>
                            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-xs text-foreground">
                              -{producto.cantidadEnviada - data.cantidadRecibida}
                            </span>
                          </>
                        )}
                        {data.cantidadRecibida > producto.cantidadEnviada && (
                          <>
                            <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                            <span className="text-xs text-foreground">
                              +{data.cantidadRecibida - producto.cantidadEnviada}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tercera fila: Comentario y botón - */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Columna combinada para comentarios (ocupa 2 columnas) */}
                  <div className="col-span-2 space-y-3">
                    {/* Observaciones del envío (si existen) */}
                    {producto.observacionesEnvio && (
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2">
                        <div className="flex items-start gap-1.5">
                          <Package className="h-3 w-3 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-0.5">
                              Comentario del envío:
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap break-words">
                              {producto.observacionesEnvio}
                            </p>
                          </div>
                        </div>
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
                        disabled={!data.esDevolucion && data.cantidadRecibida >= producto.cantidadEnviada}
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
                          !data.esDevolucion && data.cantidadRecibida >= producto.cantidadEnviada && "text-muted-foreground cursor-not-allowed"
                        )}
                      >
                        Marcar como devolución
                      </Label>
                    </div>

                    {/* Mostrar errores de validación del dominio */}
                    {erroresValidacion
                      .filter(error => error.productoId === producto.productoId)
                      .map((error, index) => (
                        <div key={index} className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                          <p className="text-xs text-red-800 dark:text-red-200">{error.mensaje}</p>
                        </div>
                      ))}
                  </div>

                  {/* Columna Recibido: solo botón - */}
                  <div className="flex items-start justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 border-2 hover:bg-muted p-0"
                      onClick={() => decrementarCantidad(producto.productoId)}
                      disabled={data.cantidadRecibida === 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Mensaje de devolución si aplica */}
                {data.cantidadRecibida !== producto.cantidadEnviada && data.esDevolucion && (
                  <div className="mt-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      {data.cantidadRecibida < producto.cantidadEnviada 
                        ? "Se devolverán las unidades faltantes"
                        : "Se devolverán los productos excedentes"}
                    </p>
                  </div>
                )}
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
