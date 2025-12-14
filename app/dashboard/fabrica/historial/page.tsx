"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useData } from "@/contexts/data-context"
import { useFabricaRemitos } from "@/hooks/use-fabrica-remitos"
import { useRemitos } from "@/hooks/use-remitos"
import { FileText, Loader2, Download, Search, CheckCircle2, XCircle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Remito } from "@/lib/types"

export default function FabricaHistorialPage() {
  const { user } = useData()
  const { remitos, loading, obtenerNombrePedido, obtenerNombreSucursal, tieneFirma } = useFabricaRemitos(user)
  const { descargarPDFRemito } = useRemitos(user)
  const [busqueda, setBusqueda] = useState("")
  const [remitoSeleccionado, setRemitoSeleccionado] = useState<Remito | null>(null)
  const [filtroSucursal, setFiltroSucursal] = useState<string>("")

  // Filtrar remitos
  const remitosFiltrados = useMemo(() => {
    let filtrados = remitos

    // Filtrar por búsqueda (número de remito o nombre de pedido)
    if (busqueda.trim()) {
      const busquedaLower = busqueda.toLowerCase()
      filtrados = filtrados.filter((r) => {
        const nombrePedido = obtenerNombrePedido(r).toLowerCase()
        const numeroRemito = r.numero?.toLowerCase() || ""
        return nombrePedido.includes(busquedaLower) || numeroRemito.includes(busquedaLower)
      })
    }

    // Filtrar por sucursal
    if (filtroSucursal) {
      filtrados = filtrados.filter((r) => {
        const sucursal = obtenerNombreSucursal(r)
        return sucursal === filtroSucursal
      })
    }

    return filtrados
  }, [remitos, busqueda, filtroSucursal, obtenerNombrePedido, obtenerNombreSucursal])

  // Obtener lista única de sucursales
  const sucursales = useMemo(() => {
    const sucursalesSet = new Set<string>()
    remitos.forEach((r) => {
      const sucursal = obtenerNombreSucursal(r)
      if (sucursal) {
        sucursalesSet.add(sucursal)
      }
    })
    return Array.from(sucursalesSet).sort()
  }, [remitos, obtenerNombreSucursal])

  // Formatear fecha
  const formatearFecha = (timestamp: any) => {
    if (!timestamp) return "Sin fecha"
    try {
      const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return format(fecha, "dd/MM/yyyy", { locale: es })
    } catch {
      return "Fecha inválida"
    }
  }

  // Formatear fecha y hora
  const formatearFechaHora = (timestamp: any) => {
    if (!timestamp) return "Sin fecha"
    try {
      const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return format(fecha, "dd/MM/yyyy HH:mm", { locale: es })
    } catch {
      return "Fecha inválida"
    }
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
        {/* Header - Mobile-first */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Historial de Remitos</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Remitos finales generados y recibidos
          </p>
        </div>

        {/* Filtros - Mobile-first */}
        <Card>
          
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número o pedido..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-9 text-sm h-9 sm:h-10"
                  />
                </div>
              </div>
              {sucursales.length > 0 && (
                <div className="w-full sm:w-64 shrink-0">
                  <select
                    value={filtroSucursal}
                    onChange={(e) => setFiltroSucursal(e.target.value)}
                    className="w-full h-9 sm:h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Todas las sucursales</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal} value={sucursal}>
                        {sucursal}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de remitos - Mobile-first */}
        {remitosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-muted-foreground text-center">
                {busqueda || filtroSucursal
                  ? "No se encontraron remitos con los filtros aplicados"
                  : "No hay remitos finales registrados"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {remitosFiltrados.map((remito) => {
              const nombrePedido = obtenerNombrePedido(remito)
              const nombreSucursal = obtenerNombreSucursal(remito)
              const tieneFirmaCompleta = tieneFirma(remito)

              return (
                <Card key={remito.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg truncate">Remito {remito.numero}</CardTitle>
                        <CardDescription className="mt-1 text-xs sm:text-sm line-clamp-2">
                          {nombrePedido} • {nombreSucursal}
                        </CardDescription>
                      </div>
                      <Badge variant={tieneFirmaCompleta ? "default" : "secondary"} className="shrink-0 text-xs">
                        {tieneFirmaCompleta ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Firmado
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Sin firma
                          </>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 pt-0 px-3 sm:px-6">
                    <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                      <div className="break-words">Fecha: {formatearFecha(remito.fecha)}</div>
                      {remito.firmaEnvio && (
                        <div className="break-words">Firma envío: {remito.firmaEnvio.nombre}</div>
                      )}
                      {remito.firmaRecepcion && (
                        <div className="break-words">Firma recepción: {remito.firmaRecepcion.nombre}</div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto flex-1 sm:flex-initial"
                        onClick={() => setRemitoSeleccionado(remito)}
                      >
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Ver</span>
                        <span className="sm:hidden">Ver detalles</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto flex-1 sm:flex-initial"
                        onClick={() => descargarPDFRemito(remito)}
                      >
                        <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Descargar PDF</span>
                        <span className="sm:hidden">PDF</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Dialog para ver remito - Mobile-first */}
        {remitoSeleccionado && (
          <Dialog open={!!remitoSeleccionado} onOpenChange={() => setRemitoSeleccionado(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Remito {remitoSeleccionado.numero}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {obtenerNombrePedido(remitoSeleccionado)} • {obtenerNombreSucursal(remitoSeleccionado)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="font-semibold">Fecha:</span> {formatearFecha(remitoSeleccionado.fecha)}
                  </div>
                  <div>
                    <span className="font-semibold">Desde:</span> {remitoSeleccionado.desde}
                  </div>
                  <div>
                    <span className="font-semibold">Hacia:</span> {remitoSeleccionado.hacia}
                  </div>
                  {remitoSeleccionado.horaRetiroFabrica && (
                    <div>
                      <span className="font-semibold">Hora retiro:</span> {remitoSeleccionado.horaRetiroFabrica}
                    </div>
                  )}
                  {remitoSeleccionado.horaRecepcionLocal && (
                    <div>
                      <span className="font-semibold">Hora recepción:</span> {remitoSeleccionado.horaRecepcionLocal}
                    </div>
                  )}
                </div>

                {remitoSeleccionado.observaciones && (
                  <div className="border rounded-lg p-3 sm:p-4">
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Observaciones:</h3>
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{remitoSeleccionado.observaciones}</p>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <div className="p-2 sm:p-3 border-b bg-muted/50">
                    <h3 className="font-semibold text-sm sm:text-base">Productos</h3>
                  </div>
                  <div className="divide-y">
                    {remitoSeleccionado.productos.map((producto, idx) => (
                      <div key={idx} className="p-2 sm:p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div className="col-span-1 sm:col-span-2 font-medium break-words">{producto.productoNombre}</div>
                        <div className="sm:col-span-1">Pedida: {producto.cantidadPedida || 0}</div>
                        <div className="sm:col-span-1">Enviada: {producto.cantidadEnviada || 0}</div>
                        {producto.cantidadRecibida !== undefined && (
                          <div className="col-span-1 sm:col-span-4">Recibida: {producto.cantidadRecibida}</div>
                        )}
                        {(producto as any).cantidadDevolucion && (
                          <div className="col-span-1 sm:col-span-4 text-destructive">
                            Devolución: {(producto as any).cantidadDevolucion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {(remitoSeleccionado.firmaEnvio || remitoSeleccionado.firmaRecepcion) && (
                  <div className="border rounded-lg p-3 sm:p-4">
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Firmas:</h3>
                    <div className="space-y-2 text-xs sm:text-sm">
                      {remitoSeleccionado.firmaEnvio && (
                        <div>
                          <span className="font-medium">Envío:</span> {remitoSeleccionado.firmaEnvio.nombre}
                          {remitoSeleccionado.firmaEnvio.firma && (
                            <img
                              src={remitoSeleccionado.firmaEnvio.firma}
                              alt="Firma envío"
                              className="mt-2 border rounded w-full max-w-[200px] sm:max-w-none"
                              style={{ maxHeight: "100px" }}
                            />
                          )}
                        </div>
                      )}
                      {remitoSeleccionado.firmaRecepcion && (
                        <div>
                          <span className="font-medium">Recepción:</span> {remitoSeleccionado.firmaRecepcion.nombre}
                          {remitoSeleccionado.firmaRecepcion.firma && (
                            <img
                              src={remitoSeleccionado.firmaRecepcion.firma}
                              alt="Firma recepción"
                              className="mt-2 border rounded w-full max-w-[200px] sm:max-w-none"
                              style={{ maxHeight: "100px" }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setRemitoSeleccionado(null)}>
                  Cerrar
                </Button>
                <Button className="w-full sm:w-auto" onClick={() => descargarPDFRemito(remitoSeleccionado)}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar PDF
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  )
}

