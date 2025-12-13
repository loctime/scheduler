"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/contexts/data-context"
import { useFabricaPedidos } from "@/hooks/use-fabrica-pedidos"
import { Package, Loader2, ExternalLink, Clock, CheckCircle2, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"

type FiltroEstado = "todos" | "pendientes" | "en-proceso"

export default function FabricaPage() {
  const { user } = useData()
  const router = useRouter()
  const { pedidos, loading, obtenerUsuarioAsignado, usuariosMap, tieneGrupos, userIdsDelGrupo, sucursalesDelGrupo } = useFabricaPedidos(user)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos")

  // Filtrar pedidos según el filtro seleccionado
  const pedidosFiltrados = useMemo(() => {
    if (filtroEstado === "todos") return pedidos
    if (filtroEstado === "pendientes") {
      return pedidos.filter(p => p.estado === "creado" || !p.estado)
    }
    if (filtroEstado === "en-proceso") {
      return pedidos.filter(p => p.estado === "processing")
    }
    return pedidos
  }, [pedidos, filtroEstado])

  // Obtener nombre de la sucursal
  const obtenerNombreSucursal = (pedido: any) => {
    const usuario = usuariosMap[pedido.userId]
    return usuario?.displayName || usuario?.email?.split("@")[0] || "Sucursal desconocida"
  }

  // Formatear fecha
  const formatearFecha = (timestamp: any) => {
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Panel de Fábrica</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Gestiona los pedidos pendientes de las sucursales de tu grupo
            </p>
            {sucursalesDelGrupo.length > 0 && (
              <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                <span className="text-xs text-muted-foreground">Sucursales:</span>
                {sucursalesDelGrupo.map((sucursal) => (
                  <Badge key={sucursal.userId} variant="outline" className="text-xs">
                    {sucursal.nombreEmpresa}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto shrink-0"
            onClick={() => router.push("/dashboard/fabrica/historial")}
          >
            <FileText className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Historial de Remitos</span>
            <span className="sm:hidden">Historial</span>
          </Button>
        </div>

        {/* Tabs - Scrollable en móvil */}
        <Tabs value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as FiltroEstado)}>
          <div className="overflow-x-auto -mx-1 sm:mx-0 scrollbar-none">
            <div className="inline-block min-w-full sm:min-w-0 px-1 sm:px-0">
              <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
                <TabsTrigger value="todos" className="text-xs sm:text-sm">
                  Todos ({pedidos.length})
                </TabsTrigger>
                <TabsTrigger value="pendientes" className="text-xs sm:text-sm">
                  Pendientes ({pedidos.filter(p => p.estado === "creado" || !p.estado).length})
                </TabsTrigger>
                <TabsTrigger value="en-proceso" className="text-xs sm:text-sm">
                  En proceso ({pedidos.filter(p => p.estado === "processing").length})
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value={filtroEstado} className="mt-4 sm:mt-6">
            {pedidosFiltrados.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
                  <Package className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  {!tieneGrupos ? (
                    <>
                      <p className="text-sm sm:text-base text-muted-foreground text-center font-medium mb-2">
                        No tienes grupos asignados
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground text-center">
                        Contacta al administrador para que te asigne a un grupo con sucursales.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm sm:text-base text-muted-foreground text-center">
                        No hay pedidos {filtroEstado === "pendientes" ? "pendientes" : filtroEstado === "en-proceso" ? "en proceso" : ""}
                      </p>
                      {userIdsDelGrupo.length === 0 && (
                        <p className="text-xs sm:text-sm text-muted-foreground text-center mt-2">
                          No hay sucursales en tus grupos asignados.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {pedidosFiltrados.map((pedido) => {
                  const usuarioAsignado = obtenerUsuarioAsignado(pedido)
                  const nombreSucursal = obtenerNombreSucursal(pedido)
                  const estaAsignado = pedido.estado === "processing" && pedido.assignedTo

                  return (
                    <Card key={pedido.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base sm:text-lg truncate">{pedido.nombre}</CardTitle>
                            <CardDescription className="mt-1 text-xs sm:text-sm truncate">
                              {nombreSucursal}
                            </CardDescription>
                          </div>
                          <Badge
                            variant={
                              pedido.estado === "processing"
                                ? "default"
                                : pedido.estado === "creado" || !pedido.estado
                                ? "secondary"
                                : "outline"
                            }
                            className="shrink-0 text-xs"
                          >
                            {pedido.estado === "processing"
                              ? "En proceso"
                              : pedido.estado === "creado" || !pedido.estado
                              ? "Pendiente"
                              : pedido.estado || "Sin estado"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 sm:space-y-4 pt-0">
                        <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">{formatearFecha(pedido.createdAt)}</span>
                          </div>
                          {estaAsignado && (
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0 mt-0.5" />
                              <span className="text-primary font-medium text-xs sm:text-sm break-words">
                                Tomado por: {pedido.assignedToNombre || usuarioAsignado?.displayName || "Usuario"}
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          className="w-full text-sm"
                          size="sm"
                          onClick={() => router.push(`/dashboard/fabrica/${pedido.id}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                          Abrir pedido
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

