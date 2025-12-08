"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Package, Check, Plus, Minus } from "lucide-react"
import type { Producto, EnlacePublico } from "@/lib/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface EnlacePublicoFormProps {
  productos: Producto[]
  enlacePublico?: EnlacePublico
  onConfirmar: (productosDisponibles: EnlacePublico["productosDisponibles"]) => void
  loading?: boolean
  pedidoConfirmado?: boolean
}

export function EnlacePublicoForm({
  productos,
  enlacePublico,
  onConfirmar,
  loading = false,
  pedidoConfirmado = false,
}: EnlacePublicoFormProps) {
  const [productosDisponibles, setProductosDisponibles] = useState<
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string; listo?: boolean; cantidadAnterior?: number }>
  >(enlacePublico?.productosDisponibles || {})
  const [productosDisponiblesOriginales, setProductosDisponiblesOriginales] = useState<
    Record<string, { disponible: boolean; cantidadEnviada?: number; observaciones?: string; listo?: boolean; cantidadAnterior?: number }>
  >(enlacePublico?.productosDisponibles || {})

  useEffect(() => {
    if (enlacePublico?.productosDisponibles) {
      setProductosDisponibles(enlacePublico.productosDisponibles)
      setProductosDisponiblesOriginales(enlacePublico.productosDisponibles)
    }
  }, [enlacePublico])

  // Detectar si hay cambios cuando el pedido está confirmado
  const hayCambios = pedidoConfirmado && JSON.stringify(productosDisponibles) !== JSON.stringify(productosDisponiblesOriginales)

  const toggleDisponible = (productoId: string) => {
    if (pedidoConfirmado && !hayCambios) {
      // Si es la primera edición después de confirmar, el modal se mostrará al intentar confirmar
    }
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
        disponible: cantidad > 0,
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

  const toggleListo = (productoId: string) => {
    setProductosDisponibles((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        listo: !prev[productoId]?.listo,
      },
    }))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {pedidoConfirmado && (
        <div className="rounded-lg border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
            ⚠️ Este pedido ya fue confirmado. Si editas las cantidades y confirmas, se cancelará el pedido anterior.
          </p>
        </div>
      )}
      <div className="space-y-3 sm:space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Productos del Pedido</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Marca los productos disponibles y especifica la cantidad a enviar
          </p>
        </div>
        
        {/* Vista móvil: Cards */}
        <div className="block md:hidden space-y-3">
          {productos
            .filter((producto) => {
              const cantidadPedida = (producto as any).cantidadPedida ?? 0
              return cantidadPedida > 0
            })
            .sort((a, b) => {
              const aData = productosDisponibles[a.id] || { listo: false, cantidadEnviada: 0 }
              const bData = productosDisponibles[b.id] || { listo: false, cantidadEnviada: 0 }
              const cantidadPedidaA = (a as any).cantidadPedida ?? 0
              const cantidadPedidaB = (b as any).cantidadPedida ?? 0
              const aCompleto = (aData.cantidadEnviada ?? 0) === cantidadPedidaA && (aData.cantidadEnviada ?? 0) > 0
              const bCompleto = (bData.cantidadEnviada ?? 0) === cantidadPedidaB && (bData.cantidadEnviada ?? 0) > 0
              const aMarcado = aCompleto || aData.listo
              const bMarcado = bCompleto || bData.listo
              // Primero los no marcados, luego los marcados (manteniendo orden original dentro de cada grupo)
              if (aMarcado === bMarcado) return 0
              return aMarcado ? 1 : -1
            })
            .map((producto) => {
              const productoData = productosDisponibles[producto.id] || { disponible: false, listo: false }
              const cantidadPedida = (producto as any).cantidadPedida ?? 0
              const cantidadEnviada = productoData.cantidadEnviada ?? 0
              const estaCompleto = cantidadEnviada === cantidadPedida && cantidadEnviada > 0
              const estaListo = productoData.listo || false
              const estaMarcado = estaCompleto || estaListo

              return (
                <div
                  key={producto.id}
                  className={`rounded-lg border-2 p-4 space-y-3 transition-colors ${
                    estaMarcado 
                      ? "bg-green-50 dark:bg-green-950/20 border-green-500/50" 
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={estaListo}
                        onCheckedChange={() => toggleListo(producto.id)}
                        className="h-7 w-7 border-2 border-foreground data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                      />
                      <span className="text-sm font-semibold">Listo</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Label className="text-sm font-semibold">
                        {producto.nombre}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={estaCompleto}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            // Guardar la cantidad actual antes de cambiarla
                            setProductosDisponibles((prev) => ({
                              ...prev,
                              [producto.id]: {
                                ...prev[producto.id],
                                cantidadAnterior: cantidadEnviada > 0 ? cantidadEnviada : undefined,
                              },
                            }))
                            updateCantidadEnviada(producto.id, cantidadPedida)
                            if (!productoData.disponible) {
                              toggleDisponible(producto.id)
                            }
                          } else {
                            // Restaurar la cantidad anterior o dejar 0
                            const cantidadARestaurar = productoData.cantidadAnterior ?? 0
                            updateCantidadEnviada(producto.id, cantidadARestaurar)
                            if (cantidadARestaurar === 0 && productoData.disponible) {
                              toggleDisponible(producto.id)
                            }
                          }
                        }}
                        className="h-7 w-7 border-2 border-foreground data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                      />
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        Pedido: {cantidadPedida} {producto.unidad || "U"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border rounded-md">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const nuevaCantidad = Math.max(0, cantidadEnviada - 1)
                            updateCantidadEnviada(producto.id, nuevaCantidad)
                            if (nuevaCantidad > 0 && !productoData.disponible) {
                              toggleDisponible(producto.id)
                            } else if (nuevaCantidad === 0 && productoData.disponible) {
                              toggleDisponible(producto.id)
                            }
                          }}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id={`cantidad-mobile-${producto.id}`}
                          type="number"
                          min="0"
                          value={cantidadEnviada}
                          onChange={(e) => {
                            const nuevaCantidad = parseInt(e.target.value) || 0
                            updateCantidadEnviada(producto.id, nuevaCantidad)
                            if (nuevaCantidad > 0 && !productoData.disponible) {
                              toggleDisponible(producto.id)
                            } else if (nuevaCantidad === 0 && productoData.disponible) {
                              toggleDisponible(producto.id)
                            }
                          }}
                          className="w-20 h-8 text-center text-sm border-0 focus-visible:ring-0"
                          placeholder={cantidadPedida.toString()}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const nuevaCantidad = cantidadEnviada + 1
                            updateCantidadEnviada(producto.id, nuevaCantidad)
                            if (!productoData.disponible) {
                              toggleDisponible(producto.id)
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        id={`obs-mobile-${producto.id}`}
                        type="text"
                        value={productoData.observaciones || ""}
                        onChange={(e) =>
                          updateObservaciones(producto.id, e.target.value)
                        }
                        placeholder="Comentario..."
                        className="flex-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        {/* Vista desktop: Tabla */}
        <div className="hidden md:block rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Listo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="w-48">Completo / Pedido</TableHead>
                <TableHead className="w-32">Cantidad a Enviar</TableHead>
                <TableHead>Comentario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos
                .filter((producto) => {
                  const cantidadPedida = (producto as any).cantidadPedida ?? 0
                  return cantidadPedida > 0
                })
                .sort((a, b) => {
                  const aData = productosDisponibles[a.id] || { listo: false, cantidadEnviada: 0 }
                  const bData = productosDisponibles[b.id] || { listo: false, cantidadEnviada: 0 }
                  const cantidadPedidaA = (a as any).cantidadPedida ?? 0
                  const cantidadPedidaB = (b as any).cantidadPedida ?? 0
                  const aCompleto = (aData.cantidadEnviada ?? 0) === cantidadPedidaA && (aData.cantidadEnviada ?? 0) > 0
                  const bCompleto = (bData.cantidadEnviada ?? 0) === cantidadPedidaB && (bData.cantidadEnviada ?? 0) > 0
                  const aMarcado = aCompleto || aData.listo
                  const bMarcado = bCompleto || bData.listo
                  // Primero los no marcados, luego los marcados (manteniendo orden original dentro de cada grupo)
                  if (aMarcado === bMarcado) return 0
                  return aMarcado ? 1 : -1
                })
                .map((producto) => {
                  const productoData = productosDisponibles[producto.id] || { disponible: false, listo: false }
                  const cantidadPedida = (producto as any).cantidadPedida ?? 0
                  const cantidadEnviada = productoData.cantidadEnviada ?? 0
                  const estaCompleto = cantidadEnviada === cantidadPedida && cantidadEnviada > 0
                  const estaListo = productoData.listo || false
                  const estaMarcado = estaCompleto || estaListo

                  return (
                    <TableRow 
                      key={producto.id}
                      className={estaMarcado ? "bg-green-50 dark:bg-green-950/20" : ""}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={estaListo}
                            onCheckedChange={() => toggleListo(producto.id)}
                            className="h-7 w-7 border-2 border-foreground data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                          />
                          <span className="text-sm font-semibold">Listo</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span>{producto.nombre}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={estaCompleto}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // Guardar la cantidad actual antes de cambiarla
                                setProductosDisponibles((prev) => ({
                                  ...prev,
                                  [producto.id]: {
                                    ...prev[producto.id],
                                    cantidadAnterior: cantidadEnviada > 0 ? cantidadEnviada : undefined,
                                  },
                                }))
                                updateCantidadEnviada(producto.id, cantidadPedida)
                                if (!productoData.disponible) {
                                  toggleDisponible(producto.id)
                                }
                              } else {
                                // Restaurar la cantidad anterior o dejar 0
                                const cantidadARestaurar = productoData.cantidadAnterior ?? 0
                                updateCantidadEnviada(producto.id, cantidadARestaurar)
                                if (cantidadARestaurar === 0 && productoData.disponible) {
                                  toggleDisponible(producto.id)
                                }
                              }
                            }}
                            className="h-7 w-7 border-2 border-foreground data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                          />
                          <span className="text-sm font-bold text-primary whitespace-nowrap">
                            Pedido: {cantidadPedida} {producto.unidad || "U"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 border rounded-md w-fit">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              const nuevaCantidad = Math.max(0, cantidadEnviada - 1)
                              updateCantidadEnviada(producto.id, nuevaCantidad)
                              if (nuevaCantidad > 0 && !productoData.disponible) {
                                toggleDisponible(producto.id)
                              } else if (nuevaCantidad === 0 && productoData.disponible) {
                                toggleDisponible(producto.id)
                              }
                            }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            id={`cantidad-${producto.id}`}
                            type="number"
                            min="0"
                            value={cantidadEnviada}
                            onChange={(e) => {
                              const nuevaCantidad = parseInt(e.target.value) || 0
                              updateCantidadEnviada(producto.id, nuevaCantidad)
                              if (nuevaCantidad > 0 && !productoData.disponible) {
                                toggleDisponible(producto.id)
                              } else if (nuevaCantidad === 0 && productoData.disponible) {
                                toggleDisponible(producto.id)
                              }
                            }}
                            className="w-16 h-7 text-center text-sm border-0 focus-visible:ring-0 px-1"
                            placeholder={cantidadPedida.toString()}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              const nuevaCantidad = cantidadEnviada + 1
                              updateCantidadEnviada(producto.id, nuevaCantidad)
                              if (!productoData.disponible) {
                                toggleDisponible(producto.id)
                              }
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          id={`obs-${producto.id}`}
                          type="text"
                          value={productoData.observaciones || ""}
                          onChange={(e) =>
                            updateObservaciones(producto.id, e.target.value)
                          }
                          placeholder="Comentario..."
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          onClick={() => onConfirmar(productosDisponibles)}
          disabled={loading}
          className="w-full sm:w-auto min-w-[150px] h-11 sm:h-10 text-base sm:text-sm"
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
