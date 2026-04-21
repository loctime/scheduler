"use client"

import React, { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useData } from "@/contexts/data-context"
import { useDespachoHoy } from "@/hooks/use-despacho-hoy"
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import type { PedidoFabrica } from "@/lib/logistica-types"
import { PedidosHistorialView } from "@/components/logistica/pedidos-historial-view"
import { ChevronDown, ChevronRight, Loader2, Truck } from "lucide-react"

// ─── helpers ──────────────────────────────────────────────────────────────────
const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function formatDiasEnvio(dias?: number[]): string {
  if (!dias || dias.length === 0) return "No definidos"
  return dias.map((d) => DIAS_SEMANA[d]).join(", ")
}

// ─── GrupoTablaView ───────────────────────────────────────────────────────────
function GrupoTablaView({
  pedidos,
  onTomarPedido,
  modoDespacho,
  cantidadesDespacho,
  onCantidadDespachoChange,
  onDespachar,
  grupoId,
  dialogAbierto,
  setDialogAbierto,
  opcionSeleccionada,
  setOpcionSeleccionada,
  sucursalesSeleccionadas,
  setSucursalesSeleccionadas,
}: {
  pedidos: PedidoFabrica[]
  onTomarPedido: (grupoId: string, pedidos: PedidoFabrica[]) => void
  modoDespacho: boolean
  cantidadesDespacho: Record<string, number>
  onCantidadDespachoChange: (productoId: string, sucursalId: string, cantidad: number) => void
  onDespachar: (grupoId: string, pedidos: PedidoFabrica[], sucursalesAFiltrar?: string[]) => void
  grupoId: string
  dialogAbierto: boolean
  setDialogAbierto: (open: boolean) => void
  opcionSeleccionada: string
  setOpcionSeleccionada: (value: string) => void
  sucursalesSeleccionadas: string[]
  setSucursalesSeleccionadas: (sucursales: string[]) => void
}) {
  const [dialogDespacharAbierto, setDialogDespacharAbierto] = useState(false)
  const [opcionDespacharSeleccionada, setOpcionDespacharSeleccionada] = useState("todos")
  const [sucursalesDespacharSeleccionadas, setSucursalesDespacharSeleccionadas] = useState<string[]>([])

  const todosProductos = useMemo(() => {
    const productosMap = new Map<string, string>()
    pedidos.forEach((pedido) => {
      pedido.items.forEach((item) => {
        if (!productosMap.has(item.productoId)) productosMap.set(item.productoId, item.productoNombre)
      })
    })
    return Array.from(productosMap.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [pedidos])

  const totalesPorProducto = useMemo(() => {
    const totales: Record<string, number> = {}
    todosProductos.forEach(({ id }) => {
      totales[id] = pedidos.reduce((acc, pedido) => {
        const item = pedido.items.find((i) => i.productoId === id)
        return acc + (item?.cantidadPedida ?? 0)
      }, 0)
    })
    return totales
  }, [todosProductos, pedidos])

  const totalesDespachoPorProducto = useMemo(() => {
    const totales: Record<string, number> = {}
    todosProductos.forEach(({ id }) => {
      totales[id] = pedidos.reduce((acc, pedido) => {
        return acc + (cantidadesDespacho[`${id}_${pedido.id}`] ?? 0)
      }, 0)
    })
    return totales
  }, [todosProductos, pedidos, cantidadesDespacho])

  const completarCantidadesProducto = (productoId: string) => {
    pedidos.forEach((pedido) => {
      const item = pedido.items.find((i) => i.productoId === productoId)
      if (item) onCantidadDespachoChange(productoId, pedido.id, item.cantidadPedida)
    })
  }

  if (pedidos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin pedidos para mostrar</p>
  }

  return (
    <div className="space-y-4">
      {/* Diálogo tomar pedidos */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tomar pedido del grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={opcionSeleccionada} onValueChange={setOpcionSeleccionada}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todos" id="todos" />
                <label htmlFor="todos">Todos</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="confirmados" id="confirmados" />
                <label htmlFor="confirmados">Solo confirmados</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <label htmlFor="manual">Manual</label>
              </div>
            </RadioGroup>
            {opcionSeleccionada === "manual" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Seleccionar sucursales:</p>
                {pedidos.map((pedido) => {
                  const esAuto = pedido.id.startsWith("auto_")
                  return (
                    <div key={pedido.id} className={`flex items-center space-x-2 p-2 rounded ${esAuto ? "bg-amber-50" : ""}`}>
                      <input
                        type="checkbox"
                        id={pedido.id}
                        checked={sucursalesSeleccionadas.includes(pedido.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSucursalesSeleccionadas([...sucursalesSeleccionadas, pedido.id])
                          else setSucursalesSeleccionadas(sucursalesSeleccionadas.filter((id) => id !== pedido.id))
                        }}
                      />
                      <label htmlFor={pedido.id} className="text-sm">
                        {pedido.origenNombre} {esAuto && "(automático)"}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogAbierto(false)}>Cancelar</Button>
              <Button onClick={() => onTomarPedido(grupoId, pedidos)}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo despachar */}
      <Dialog open={dialogDespacharAbierto} onOpenChange={setDialogDespacharAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Despachar pedidos del grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={opcionDespacharSeleccionada} onValueChange={setOpcionDespacharSeleccionada}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todos" id="despachar-todos" />
                <label htmlFor="despachar-todos">Todos</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="despachar-manual" />
                <label htmlFor="despachar-manual">Manual</label>
              </div>
            </RadioGroup>
            {opcionDespacharSeleccionada === "manual" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Seleccionar sucursales:</p>
                {pedidos.map((pedido) => {
                  const esAuto = pedido.id.startsWith("auto_")
                  return (
                    <div key={pedido.id} className={`flex items-center space-x-2 p-2 rounded ${esAuto ? "bg-amber-50" : ""}`}>
                      <input
                        type="checkbox"
                        id={`despachar-${pedido.id}`}
                        checked={sucursalesDespacharSeleccionadas.includes(pedido.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSucursalesDespacharSeleccionadas([...sucursalesDespacharSeleccionadas, pedido.id])
                          else setSucursalesDespacharSeleccionadas(sucursalesDespacharSeleccionadas.filter((id) => id !== pedido.id))
                        }}
                      />
                      <label htmlFor={`despachar-${pedido.id}`} className="text-sm">
                        {pedido.origenNombre} {esAuto && "(automático)"}
                      </label>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogDespacharAbierto(false)}>Cancelar</Button>
              <Button onClick={() => {
                const sucursalesParaDespacho = opcionDespacharSeleccionada === "todos"
                  ? pedidos.map((p) => p.id)
                  : sucursalesDespacharSeleccionadas
                onDespachar(grupoId, pedidos, sucursalesParaDespacho)
                setDialogDespacharAbierto(false)
              }}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 border bg-muted">Producto</th>
              {pedidos.map((pedido) => (
                <th key={pedido.id} className="text-left px-2 py-1.5 border bg-muted min-w-[120px]">
                  <div className="flex flex-col gap-1">
                    <span>{pedido.origenNombre}</span>
                    {pedido.controlado ? (
                      <Badge className="bg-green-50 text-green-800 border border-green-200 text-xs">Controlado</Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-xs">Automático</Badge>
                    )}
                  </div>
                </th>
              ))}
              <th className="text-left px-2 py-1.5 border bg-muted font-semibold text-blue-600">
                <div className="flex items-center gap-2">
                  <span>Total</span>
                  {!modoDespacho ? (
                    <Button size="sm" onClick={() => setDialogAbierto(true)} className="h-6 px-2 text-xs">
                      Tomar
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setDialogDespacharAbierto(true)} className="h-6 px-2 text-xs">
                      Despachar
                    </Button>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {todosProductos.map(({ id, nombre }) => (
              <tr key={id} className={modoDespacho ? "bg-muted/50" : ""}>
                <td className="px-2 py-1.5 border font-medium">
                  <div className="flex items-center gap-2">
                    <span>{nombre}</span>
                    {modoDespacho && (
                      <Button size="sm" onClick={() => completarCantidadesProducto(id)} className="h-5 px-1 text-xs" variant="outline">
                        OK
                      </Button>
                    )}
                  </div>
                </td>
                {pedidos.map((pedido) => {
                  const item = pedido.items.find((i) => i.productoId === id)
                  if (!item) return <td key={pedido.id} className="px-2 py-1.5 border text-center">-</td>
                  if (modoDespacho) {
                    const cantidad = cantidadesDespacho[`${id}_${pedido.id}`] ?? 0
                    return (
                      <td key={pedido.id} className="px-2 py-1.5 border">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{item.cantidadPedida}</span>
                          <Input
                            type="number"
                            min={0}
                            value={cantidad}
                            onChange={(e) => onCantidadDespachoChange(id, pedido.id, Math.max(0, Number(e.target.value) || 0))}
                            className={`w-20 h-6 text-xs ${
                              cantidad < item.cantidadPedida ? "border-red-500" : "border-green-500"
                            }`}
                          />
                        </div>
                      </td>
                    )
                  }
                  return <td key={pedido.id} className="px-2 py-1.5 border text-center">{item.cantidadPedida}</td>
                })}
                <td className="px-2 py-1.5 border text-center font-semibold">
                  <span className={modoDespacho ? "text-green-600" : "text-blue-600"}>
                    {modoDespacho ? totalesDespachoPorProducto[id] : totalesPorProducto[id]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function LogisticaFabricaPage() {
  const { user, userData } = useData()
  const { toast } = useToast()

  const {
    gruposVisibles,
    pedidosDeHoy,
    loading,
    gruposEnModoDespacho,
    cantidadesDespacho,
    setCantidadDespacho,
    tomarGrupo,
    despacharGrupo,
    pedidosRaw,
    remitosRaw,
    marcarEnCamino,
  } = useDespachoHoy(user)

  const [dialogTomarAbierto, setDialogTomarAbierto] = useState<string | null>(null)
  const [opcionTomarSeleccionada, setOpcionTomarSeleccionada] = useState<string>("todos")
  const [sucursalesSeleccionadas, setSucursalesSeleccionadas] = useState<string[]>([])
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})

  const puede = useMemo(
    () => canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_logistica"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const remitosEnCamino = useMemo(() => remitosRaw.filter((r) => r.estado === "en_camino"), [remitosRaw])
  const remitosPreparados = useMemo(() => remitosRaw.filter((r) => r.estado === "preparado"), [remitosRaw])

  const toggleGrupo = (grupoId: string) => {
    setGruposAbiertos((prev) => ({ ...prev, [grupoId]: !prev[grupoId] }))
  }

  useEffect(() => {
    const inicial: Record<string, boolean> = {}
    gruposVisibles.forEach((grupo) => {
      if (!(grupo.id in gruposAbiertos)) inicial[grupo.id] = true
    })
    if (Object.keys(inicial).length > 0) setGruposAbiertos((prev) => ({ ...prev, ...inicial }))
  }, [gruposVisibles])

  const handleTomarPedidos = async (grupoId: string, pedidos: PedidoFabrica[]) => {
    await tomarGrupo(
      grupoId,
      pedidos,
      opcionTomarSeleccionada as "todos" | "confirmados" | "manual",
      sucursalesSeleccionadas
    )
    setDialogTomarAbierto(null)
  }

  const handleDespacharGrupo = async (grupoId: string, pedidos: PedidoFabrica[], sucursalesAFiltrar?: string[]) => {
    await despacharGrupo(grupoId, pedidos, sucursalesAFiltrar)
  }

  const enCamino = async (remitoId: string) => {
    const res = await marcarEnCamino(remitoId)
    if (!res.ok) {
      toast({ title: "No se pudo actualizar", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Remito en camino" })
  }

  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Fábrica — logística interna</CardTitle>
            <CardDescription>Solo administradores pueden ver esta pantalla.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Tabs defaultValue="hoy">
          <TabsList>
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="activos">Remitos activos</TabsTrigger>
          </TabsList>

          <TabsContent value="hoy" className="space-y-3">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sincronizando...
              </div>
            )}
            {!loading && gruposVisibles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay grupos asignados a tu despacho para hoy.
              </p>
            )}

            {pedidosDeHoy.map(({ grupo, pedidos, autoPedidos }) => {
              const todosLosPedidos: PedidoFabrica[] = [...pedidos, ...autoPedidos]
              const estaAbierto = gruposAbiertos[grupo.id] ?? true

              return (
                <Card key={grupo.id}>
                  <button type="button" className="w-full text-left" onClick={() => toggleGrupo(grupo.id)}>
                    <CardHeader className="py-2 px-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className="text-sm font-semibold shrink-0">{grupo.nombre}</CardTitle>
                        <CardDescription className="text-xs shrink-0">
                          {pedidos.length === 0 && autoPedidos.length === 0
                            ? "Sin pedidos"
                            : pedidos.length === 0
                            ? `${autoPedidos.length} sin confirmar`
                            : `${pedidos.length} confirmado(s)${autoPedidos.length > 0 ? ` · ${autoPedidos.length} sin confirmar` : ""}`}
                        </CardDescription>
                        <span className="ml-auto text-xs text-muted-foreground shrink-0">
                          Días: {formatDiasEnvio(grupo.diasEnvio)}
                        </span>
                        {estaAbierto ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                  </button>

                  {estaAbierto && (
                    <CardContent className="space-y-3 px-4 pb-3 pt-0">
                      {todosLosPedidos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin pedidos ni diferencias de stock</p>
                      ) : (
                        <GrupoTablaView
                          pedidos={todosLosPedidos}
                          onTomarPedido={handleTomarPedidos}
                          modoDespacho={gruposEnModoDespacho[grupo.id] || false}
                          cantidadesDespacho={cantidadesDespacho[grupo.id] || {}}
                          onCantidadDespachoChange={(productoId, sucursalId, cantidad) =>
                            setCantidadDespacho(grupo.id, productoId, sucursalId, cantidad)
                          }
                          onDespachar={handleDespacharGrupo}
                          grupoId={grupo.id}
                          dialogAbierto={dialogTomarAbierto === grupo.id}
                          setDialogAbierto={(open) => setDialogTomarAbierto(open ? grupo.id : null)}
                          opcionSeleccionada={opcionTomarSeleccionada}
                          setOpcionSeleccionada={setOpcionTomarSeleccionada}
                          sucursalesSeleccionadas={sucursalesSeleccionadas}
                          setSucursalesSeleccionadas={setSucursalesSeleccionadas}
                        />
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="historial">
            <PedidosHistorialView pedidos={pedidosRaw} />
          </TabsContent>

          <TabsContent value="activos" className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4" />
                En camino (repartidor)
              </h3>
              {remitosEnCamino.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay remitos en camino.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {remitosEnCamino.map((r) => (
                    <li key={r.id} className="rounded-md border border-border px-3 py-2">
                      <span className="font-mono">{r.numero}</span> · {r.destinoNombre} · {r.items.length} ítem(s)
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Preparados (marcar salida)</h3>
              {remitosPreparados.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay remitos preparados.</p>
              ) : (
                <ul className="space-y-2">
                  {remitosPreparados.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm">
                        <span className="font-mono font-medium">{r.numero}</span> → {r.destinoNombre}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => void enCamino(r.id)}>
                        Marcar en camino
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
