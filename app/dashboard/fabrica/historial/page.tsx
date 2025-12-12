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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Historial de Remitos</h1>
          <p className="text-muted-foreground mt-2">
            Remitos finales generados y recibidos
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número de remito o pedido..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {sucursales.length > 0 && (
                <div className="sm:w-64">
                  <select
                    value={filtroSucursal}
                    onChange={(e) => setFiltroSucursal(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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

        {/* Lista de remitos */}
        {remitosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {busqueda || filtroSucursal
                  ? "No se encontraron remitos con los filtros aplicados"
                  : "No hay remitos finales registrados"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {remitosFiltrados.map((remito) => {
              const nombrePedido = obtenerNombrePedido(remito)
              const nombreSucursal = obtenerNombreSucursal(remito)
              const tieneFirmaCompleta = tieneFirma(remito)

              return (
                <Card key={remito.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">Remito {remito.numero}</CardTitle>
                        <CardDescription className="mt-1">
                          {nombrePedido} • {nombreSucursal}
                        </CardDescription>
                      </div>
                      <Badge variant={tieneFirmaCompleta ? "default" : "secondary"}>
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
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Fecha: {formatearFecha(remito.fecha)}</div>
                      {remito.firmaEnvio && (
                        <div>Firma envío: {remito.firmaEnvio.nombre}</div>
                      )}
                      {remito.firmaRecepcion && (
                        <div>Firma recepción: {remito.firmaRecepcion.nombre}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRemitoSeleccionado(remito)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => descargarPDFRemito(remito)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Descargar PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Dialog para ver remito */}
        {remitoSeleccionado && (
          <Dialog open={!!remitoSeleccionado} onOpenChange={() => setRemitoSeleccionado(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Remito {remitoSeleccionado.numero}</DialogTitle>
                <DialogDescription>
                  {obtenerNombrePedido(remitoSeleccionado)} • {obtenerNombreSucursal(remitoSeleccionado)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
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
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Observaciones:</h3>
                    <p className="text-sm whitespace-pre-wrap">{remitoSeleccionado.observaciones}</p>
                  </div>
                )}

                <div className="border rounded-lg">
                  <div className="p-3 border-b bg-muted/50">
                    <h3 className="font-semibold">Productos</h3>
                  </div>
                  <div className="divide-y">
                    {remitoSeleccionado.productos.map((producto, idx) => (
                      <div key={idx} className="p-3 grid grid-cols-4 gap-4 text-sm">
                        <div className="col-span-2 font-medium">{producto.productoNombre}</div>
                        <div>Pedida: {producto.cantidadPedida || 0}</div>
                        <div>Enviada: {producto.cantidadEnviada || 0}</div>
                        {producto.cantidadRecibida !== undefined && (
                          <div className="col-span-4">Recibida: {producto.cantidadRecibida}</div>
                        )}
                        {(producto as any).cantidadDevolucion && (
                          <div className="col-span-4 text-destructive">
                            Devolución: {(producto as any).cantidadDevolucion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {(remitoSeleccionado.firmaEnvio || remitoSeleccionado.firmaRecepcion) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Firmas:</h3>
                    <div className="space-y-2 text-sm">
                      {remitoSeleccionado.firmaEnvio && (
                        <div>
                          <span className="font-medium">Envío:</span> {remitoSeleccionado.firmaEnvio.nombre}
                          {remitoSeleccionado.firmaEnvio.firma && (
                            <img
                              src={remitoSeleccionado.firmaEnvio.firma}
                              alt="Firma envío"
                              className="mt-2 border rounded"
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
                              className="mt-2 border rounded"
                              style={{ maxHeight: "100px" }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRemitoSeleccionado(null)}>
                  Cerrar
                </Button>
                <Button onClick={() => descargarPDFRemito(remitoSeleccionado)}>
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

