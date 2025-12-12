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
  const { pedidos, loading, obtenerUsuarioAsignado, usuariosMap } = useFabricaPedidos(user)
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Panel de Fábrica</h1>
            <p className="text-muted-foreground mt-2">
              Gestiona los pedidos pendientes de todas las sucursales
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/fabrica/historial")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Historial de Remitos
          </Button>
        </div>

        <Tabs value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as FiltroEstado)}>
          <TabsList>
            <TabsTrigger value="todos">
              Todos ({pedidos.length})
            </TabsTrigger>
            <TabsTrigger value="pendientes">
              Pendientes ({pedidos.filter(p => p.estado === "creado" || !p.estado).length})
            </TabsTrigger>
            <TabsTrigger value="en-proceso">
              En proceso ({pedidos.filter(p => p.estado === "processing").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filtroEstado} className="mt-6">
            {pedidosFiltrados.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No hay pedidos {filtroEstado === "pendientes" ? "pendientes" : filtroEstado === "en-proceso" ? "en proceso" : ""}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pedidosFiltrados.map((pedido) => {
                  const usuarioAsignado = obtenerUsuarioAsignado(pedido)
                  const nombreSucursal = obtenerNombreSucursal(pedido)
                  const estaAsignado = pedido.estado === "processing" && pedido.assignedTo

                  return (
                    <Card key={pedido.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{pedido.nombre}</CardTitle>
                            <CardDescription className="mt-1">
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
                          >
                            {pedido.estado === "processing"
                              ? "En proceso"
                              : pedido.estado === "creado" || !pedido.estado
                              ? "Pendiente"
                              : pedido.estado || "Sin estado"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{formatearFecha(pedido.createdAt)}</span>
                          </div>
                          {estaAsignado && (
                            <div className="flex items-center gap-2 mt-2">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              <span className="text-primary font-medium">
                                Tomado por: {pedido.assignedToNombre || usuarioAsignado?.displayName || "Usuario"}
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => router.push(`/dashboard/fabrica/${pedido.id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
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

