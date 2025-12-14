"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, Plus, Minus, CheckCircle2 } from "lucide-react"
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
      // Convertir array a Record si es necesario (incluir observaciones)
      const productosDisponiblesInicial = enlacePublico?.productosDisponibles
        ? Array.isArray(enlacePublico.productosDisponibles)
          ? enlacePublico.productosDisponibles.reduce((acc, item) => {
              acc[item.productoId] = {
                disponible: item.disponible,
                cantidadEnviada: item.cantidadEnviar,
                observaciones: item.observaciones,
              }
              return acc
            }, {} as Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>)
          : enlacePublico.productosDisponibles
        : {}

  const [productosDisponibles, setProductosDisponibles] = useState<      
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string; completo?: boolean; listo?: boolean }>                                                            
  >(productosDisponiblesInicial)
  const [observacionesHabilitadas, setObservacionesHabilitadas] = useState<Record<string, boolean>>({})
  const ultimoProductoMarcadoRef = useRef<string | null>(null)
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  
  // Determinar si estamos en modo "en proceso" (similar a enlace público)
  const modoEnProceso = pedido.estado === "processing" && puedeGenerarRemito

  useEffect(() => {
    const productos = enlacePublico?.productosDisponibles
    if (productos) {
      // Convertir array a Record si es necesario (incluir observaciones)
      const productosRecord = Array.isArray(productos)
        ? productos.reduce((acc, item) => {
            acc[item.productoId] = {
              disponible: item.disponible,
              cantidadEnviada: item.cantidadEnviar,
              observaciones: item.observaciones,
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

  // Función para hacer scroll al siguiente producto incompleto (solo en modo en proceso)
  const scrollToNextIncomplete = (currentProductoId: string, estadoActualizado?: typeof productosDisponibles) => {
    if (!modoEnProceso) return
    
    setTimeout(() => {
      const productosFiltrados = productos.filter((p) => {
        const cantidadPedida = (p as any).cantidadPedida ?? 0
        return cantidadPedida > 0
      })

      const currentIndex = productosFiltrados.findIndex((p) => p.id === currentProductoId)
      if (currentIndex === -1) return

      const estadoAUsar = estadoActualizado || productosDisponibles

      for (let i = currentIndex + 1; i < productosFiltrados.length; i++) {
        const producto = productosFiltrados[i]
        const productoData = estadoAUsar[producto.id] || {}
        const completado = productoData.completo || productoData.listo

        if (!completado) {
          const element = document.getElementById(`producto-${producto.id}`)
          if (element) {
            element.scrollIntoView({
              behavior: "smooth",
              block: "center",
            })
            element.classList.add("ring-4", "ring-blue-400", "ring-opacity-50")
            setTimeout(() => {
              element.classList.remove("ring-4", "ring-blue-400", "ring-opacity-50")
            }, 1000)
            break
          }
        }
      }
    }, 150)
  }

  const toggleDisponible = (productoId: string) => {
    setProductosDisponibles((prev) => {
      const current = prev[productoId] || { disponible: false }
      return {
        ...prev,
        [productoId]: {
          ...current,
          disponible: !current.disponible,
          cantidadEnviada: !current.disponible ? (current.cantidadEnviada || 0) : 0,
          completo: current.completo && !current.disponible ? current.completo : undefined,
          listo: current.listo && !current.disponible ? current.listo : undefined,
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
          disponible: cantidad > 0,
          cantidadEnviada: Math.max(0, cantidad),
          completo: undefined,
          listo: cantidad > 0 ? current.listo : undefined,
        },
      }
    })
  }

  const toggleCompleto = (productoId: string, cantidadPedida: number, current?: { cantidadEnviada?: number }) => {
    const estabaCompleto = productosDisponibles[productoId]?.completo
    setProductosDisponibles((prev) => {
      const nuevoEstado = {
        ...prev,
        [productoId]: {
          ...prev[productoId],
          disponible: true,
          completo: !prev[productoId]?.completo,
          listo: !prev[productoId]?.completo ? true : prev[productoId]?.listo,
          cantidadEnviada: !prev[productoId]?.completo ? cantidadPedida : current?.cantidadEnviada,
        },
      }
      
      if (!estabaCompleto && modoEnProceso) {
        ultimoProductoMarcadoRef.current = productoId
        scrollToNextIncomplete(productoId, nuevoEstado)
      }
      
      return nuevoEstado
    })
  }

  const toggleListo = (productoId: string) => {
    const estabaListo = productosDisponibles[productoId]?.listo
    const producto = productos.find(p => p.id === productoId)
    const cantidadPedida = (producto as any)?.cantidadPedida ?? 0
    const cantidadActual = productosDisponibles[productoId]?.cantidadEnviada ?? 0
    
    setProductosDisponibles((prev) => {
      const nuevoEstado = {
        ...prev,
        [productoId]: {
          ...prev[productoId],
          disponible: true,
          listo: !prev[productoId]?.listo,
          completo: prev[productoId]?.listo ? prev[productoId]?.completo : undefined,
        },
      }
      
      // Si se marca como listo y la cantidad es menor, activar comentarios automáticamente
      if (!estabaListo && !prev[productoId]?.listo && cantidadActual < cantidadPedida) {
        setObservacionesHabilitadas((prevObs) => ({
          ...prevObs,
          [productoId]: true,
        }))
        // Inicializar observaciones si no existe
        if (!prev[productoId]?.observaciones) {
          nuevoEstado[productoId].observaciones = ""
        }
        // Hacer focus en el textarea después de activar automáticamente
        setTimeout(() => {
          const textarea = textareaRefs.current[productoId]
          if (textarea) {
            textarea.focus()
          }
        }, 100)
      }
      
      if (!estabaListo && modoEnProceso) {
        ultimoProductoMarcadoRef.current = productoId
        scrollToNextIncomplete(productoId, nuevoEstado)
      }
      
      return nuevoEstado
    })
  }

  const incrementarCantidad = (productoId: string) => {
    const productoData = productosDisponibles[productoId] || {}
    const cantidadActual = productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0
    updateCantidad(productoId, cantidadActual + 1)
  }

  const decrementarCantidad = (productoId: string) => {
    const productoData = productosDisponibles[productoId] || {}
    const cantidadActual = productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0
    if (cantidadActual > 0) {
      updateCantidad(productoId, cantidadActual - 1)
    }
  }

  const toggleObservaciones = (productoId: string) => {
    setObservacionesHabilitadas((prev) => {
      const nuevoEstado = !prev[productoId]
      if (!nuevoEstado) {
        updateObservaciones(productoId, "")
      }
      return {
        ...prev,
        [productoId]: nuevoEstado,
      }
    })
    
    if (!observacionesHabilitadas[productoId]) {
      setProductosDisponibles((prev) => ({
        ...prev,
        [productoId]: {
          ...(prev[productoId] || { disponible: false }),
          observaciones: "",
        },
      }))
      // Hacer focus en el textarea después de activar
      setTimeout(() => {
        const textarea = textareaRefs.current[productoId]
        if (textarea) {
          textarea.focus()
        }
      }, 0)
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
    // Limpiar campos que no deben guardarse en Firebase (completo, listo)
    const productosDisponiblesLimpios = Object.entries(productosDisponibles).reduce((acc, [key, value]) => {
      acc[key] = {
        disponible: value.disponible,
        cantidadEnviada: value.cantidadEnviada,
        observaciones: value.observaciones,
      }
      return acc
    }, {} as Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string }>)
    
    // Validar que haya al menos un producto disponible (puede tener cantidad 0 si tiene observaciones)
    const productosDisponiblesCount = Object.entries(productosDisponiblesLimpios).filter(
      ([_, data]) => data.disponible === true
    ).length

    if (productosDisponiblesCount === 0) {
      alert("Debes marcar al menos un producto como disponible")
      return
    }

    // Convertir Record a array (incluir observaciones)
    const productosDisponiblesArray = Object.entries(productosDisponiblesLimpios).map(([productoId, data]) => ({
      productoId,
      disponible: data.disponible,
      cantidadEnviar: data.cantidadEnviada,
      observaciones: data.observaciones,
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
      {modoEnProceso ? (
        // Modo "en proceso" - Diseño similar a enlace público
        <div className="space-y-4">
          {productosFiltrados.map((producto) => {
            const cantidadPedida = (producto as any).cantidadPedida ?? 0
            const productoData = productosDisponibles[producto.id] || { disponible: false }
            const completado = productoData.completo || productoData.listo
            const cantidadActual = productoData.cantidadEnviada !== undefined ? productoData.cantidadEnviada : 0

            // Determinar el color del recuadro según la cantidad
            let cardClassName = "rounded-xl border-2 p-4 space-y-4 transition-all "
            if (cantidadActual > cantidadPedida) {
              cardClassName += "border-red-500 bg-red-50 dark:bg-red-950/40 shadow-md"
            } else if (completado) {
              cardClassName += "border-green-500 bg-green-50 dark:bg-green-950/40 shadow-md"
            } else if (cantidadActual === cantidadPedida && cantidadActual > 0) {
              cardClassName += "border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-md"
            } else {
              cardClassName += "border-border bg-card shadow-sm hover:shadow-md"
            }

            return (
              <div
                id={`producto-${producto.id}`}
                key={producto.id}
                className={cardClassName}
              >
                {/* Línea superior: Producto >>> Pedida >>> Completo (derecha) */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-base font-semibold text-foreground truncate">
                      {producto.nombre}
                    </span>
                    <span className="text-muted-foreground hidden sm:inline">•</span>
                    <div className="flex items-center gap-1.5 whitespace-nowrap bg-muted/50 dark:bg-muted/30 px-2.5 py-1 rounded-md border border-border">
                      <span className="text-sm font-medium text-muted-foreground">Pedida:</span>
                      <span className={`text-lg font-bold ${
                        productoData.listo && cantidadActual < cantidadPedida 
                          ? "text-red-600 dark:text-red-400" 
                          : "text-foreground"
                      }`}>
                        {cantidadPedida}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">{producto.unidad || "U"}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={productoData.completo ? "default" : "outline"}
                    size="sm"
                    className={`h-14 px-4 shrink-0 border-2 ${
                      productoData.completo 
                        ? "bg-green-600 hover:bg-green-700 border-green-600" 
                        : "hover:bg-muted"
                    }`}
                    onClick={() => toggleCompleto(producto.id, cantidadPedida, productoData)}
                    title="Marcar como completo"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    TODO
                  </Button>
                </div>

                {/* Campo numérico con botones + Botón Listo */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0 border-2 hover:bg-muted"
                      onClick={() => decrementarCantidad(producto.id)}
                      disabled={cantidadActual === 0}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <Input
                      id={`cantidad-${producto.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={cantidadActual}
                      onChange={(e) => {
                        const valor = e.target.value === "" ? 0 : parseInt(e.target.value) || 0
                        updateCantidad(producto.id, valor)
                      }}
                      placeholder={cantidadPedida.toString()}
                      className="text-lg font-semibold text-center h-12 border-2 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0 border-2 hover:bg-muted"
                      onClick={() => incrementarCantidad(producto.id)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant={productoData.listo ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleListo(producto.id)}
                    className={`shrink-0 h-12 ${productoData.listo ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Listo
                  </Button>
                </div>

                {/* Checkbox de comentario */}
                <div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`habilitar-obs-${producto.id}`}
                      checked={!!observacionesHabilitadas[producto.id]}
                      onCheckedChange={() => toggleObservaciones(producto.id)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`habilitar-obs-${producto.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                      Agregar comentario
                    </Label>
                  </div>
                  {observacionesHabilitadas[producto.id] && (
                    <Textarea
                      ref={(el) => {
                        textareaRefs.current[producto.id] = el
                      }}
                      id={`obs-${producto.id}`}
                      value={productoData.observaciones ?? ""}
                      onChange={(e) => updateObservaciones(producto.id, e.target.value)}
                      placeholder="Escribe un comentario..."
                      rows={2}
                      className="text-sm resize-none border-2 mt-2"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Modo normal (pendiente) - Grid de 2 columnas
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {productosFiltrados.map((producto) => {
            const cantidadPedida = (producto as any).cantidadPedida ?? 0
            const productoData = productosDisponibles[producto.id] || { disponible: false }
            const disponible = productoData.disponible
            const cantidadEnviada = productoData.cantidadEnviada ?? 0

            return (
              <div
                key={producto.id}
                id={`producto-${producto.id}`}
                className={`border rounded-lg p-2 sm:p-3 space-y-2 ${disponible ? 'sm:col-span-2' : ''}`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <Checkbox
                    checked={disponible}
                    onCheckedChange={() => toggleDisponible(producto.id)}
                    disabled={!puedeGenerarRemito}
                    className="shrink-0"
                  />
                  <span className="text-base sm:text-lg font-medium cursor-pointer break-words text-foreground">
                    {producto.nombre}
                    <span className="ml-2 text-sm sm:text-base font-normal text-muted-foreground">
                      ({cantidadPedida} {producto.unidad || "U"})
                    </span>
                  </span>
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
      )}

      {puedeGenerarRemito && (
        <div className={`${modoEnProceso ? 'sticky bottom-0 pt-4 pb-2 bg-background border-t-2 mt-6' : 'flex justify-end pt-3 sm:pt-4 border-t'}`}>
          <Button 
            onClick={handleConfirmar} 
            size="lg" 
            className={modoEnProceso ? "w-full h-12 text-base font-semibold shadow-lg" : "w-full sm:w-auto"}
          >
            <Check className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            {modoEnProceso ? "Confirmar Envío" : "Generar remito"}
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

