"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import type { RecepcionLogItem } from "@/lib/logistica-types"
import { ClipboardCheck, Loader2 } from "lucide-react"

export default function RecepcionesLogisticaPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const { remitosRaw, remitosRecibidos, confirmarRecepcion, loading, isAdmin } = useLogistica(user)

  const puede = useMemo(
    () =>
      canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "recibir_pedido") &&
      (userData?.role === "operador" || userData?.role === "admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const enTransito = useMemo(() => {
    const base = isAdmin ? remitosRaw : remitosRecibidos
    return base.filter((r) => r.estado === "preparado" || r.estado === "en_camino")
  }, [isAdmin, remitosRaw, remitosRecibidos])

  const remitosEntregados = useMemo(() => {
    const base = isAdmin ? remitosRaw : remitosRecibidos
    return base
      .filter((r) => r.estado === "entregado")
      .sort((a, b) => {
        const ts = (v: unknown) => {
          if (v && typeof v === "object" && "toMillis" in v) return (v as { toMillis: () => number }).toMillis()
          return 0
        }
        return ts(b.actualizadoEn) - ts(a.actualizadoEn)
      })
  }, [isAdmin, remitosRaw, remitosRecibidos])

  const [selId, setSelId] = useState<string | null>(null)
  const sel = useMemo(() => enTransito.find((r) => r.id === selId) ?? null, [enTransito, selId])

  const [abiertosHistorial, setAbiertosHistorial] = useState<Set<string>>(new Set())
  const [recibido, setRecibido] = useState<Record<string, number>>({})
  const [coment, setComent] = useState<Record<string, string>>({})
  const [obs, setObs] = useState("")
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!sel) {
      setRecibido({})
      setComent({})
      setObs("")
      return
    }
    const r: Record<string, number> = {}
    const c: Record<string, string> = {}
    for (const it of sel.items) {
      r[it.productoId] = it.cantidadEnviada
      c[it.productoId] = ""
    }
    setRecibido(r)
    setComent(c)
    setObs("")
  }, [sel])

  const confirmar = async () => {
    if (!sel) return
    const items: RecepcionLogItem[] = sel.items.map((it) => ({
      productoId: it.productoId,
      productoNombre: it.productoNombre,
      cantidadEnviada: it.cantidadEnviada,
      cantidadRecibida: Math.max(0, Math.floor(recibido[it.productoId] ?? it.cantidadEnviada)),
      ...(coment[it.productoId]?.trim() ? { comentario: coment[it.productoId].trim() } : {}),
    }))
    setProcesando(true)
    const res = await confirmarRecepcion({
      remitoId: sel.id,
      items,
      observacion: obs.trim() || undefined,
    })
    setProcesando(false)
    if (!res.ok) {
      toast({ title: "No se pudo confirmar", description: res.error, variant: "destructive" })
      return
    }
    let desc = "Stock actualizado en destino."
    if (res.pendientesGenerados && res.pendientesGenerados > 0) {
      desc = `Hubo faltantes en ${res.pendientesGenerados} ítem(s): se creó un pedido pendiente automático (estado enviado) hacia el origen del remito.`
    }
    toast({ title: "Recepción registrada", description: desc })
    setSelId(null)
  }

  if (!puede) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardHeader>
            <CardTitle>Recepciones</CardTitle>
            <CardDescription>No tenés permiso para usar esta pantalla.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7" />
            Recepciones internas
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Confirmá lo que llegó a tu sucursal. Los remitos en preparado o en camino aparecen abajo.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sincronizando…
          </div>
        )}

        <Tabs defaultValue="pendientes">
          <TabsList>
            <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="pendientes" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Remitos pendientes de recepción</CardTitle>
                <CardDescription>Tocá un remito para cargar cantidades recibidas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {enTransito.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground">No hay remitos para recepcionar.</p>
                )}
                {enTransito.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelId(r.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selId === r.id ? "border-primary bg-muted/40" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <span className="font-mono font-medium">{r.numero}</span>
                    <span className="text-muted-foreground"> · desde {r.origenNombre}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {r.estado === "preparado" ? "Preparado" : "En camino"} · {r.items.length} ítem(s)
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>

            {sel && (
              <Card>
                <CardHeader>
                  <CardTitle>Remito {sel.numero}</CardTitle>
                  <CardDescription>¿Cuánto llegó de cada línea?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sel.items.map((it) => (
                    <div
                      key={it.productoId}
                      className="rounded-md border border-border p-3 space-y-2"
                    >
                      <div className="font-medium text-sm">{it.productoNombre}</div>
                      <div className="text-xs text-muted-foreground">Enviado: {it.cantidadEnviada}</div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Cantidad recibida</Label>
                          <Input
                            type="number"
                            min={0}
                            value={recibido[it.productoId] ?? it.cantidadEnviada}
                            onChange={(e) =>
                              setRecibido((s) => ({
                                ...s,
                                [it.productoId]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                              }))
                            }
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Comentario</Label>
                          <Input
                            value={coment[it.productoId] ?? ""}
                            onChange={(e) =>
                              setComent((s) => ({ ...s, [it.productoId]: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <Label className="text-xs">Observación general</Label>
                    <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
                  </div>
                  <Button onClick={() => void confirmar()} disabled={procesando}>
                    {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Confirmar recepción
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historial" className="space-y-3 mt-4">
            {remitosEntregados.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No hay remitos entregados todavía.</p>
            )}
            {remitosEntregados.map((r) => {
              const abierto = abiertosHistorial.has(r.id)
              const actualizadoMs =
                r.actualizadoEn && typeof r.actualizadoEn === "object" && "toMillis" in r.actualizadoEn
                  ? (r.actualizadoEn as { toMillis: () => number }).toMillis()
                  : 0
              const fecha = actualizadoMs
                ? new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(actualizadoMs))
                : "—"
              return (
                <Card key={r.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setAbiertosHistorial((prev) => {
                        const next = new Set(prev)
                        if (next.has(r.id)) next.delete(r.id)
                        else next.add(r.id)
                        return next
                      })
                    }
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-medium">{r.numero}</span>
                            <Badge className="bg-green-50 text-green-800 border border-green-200">Entregado</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {r.origenNombre} → {r.destinoNombre}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {fecha}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {abierto ? "Ocultar" : "Ver items"}
                        </div>
                      </div>
                    </CardHeader>
                  </button>
                  {abierto && (
                    <CardContent className="space-y-2 pt-0">
                      {r.items.map((it) => (
                        <div key={it.productoId} className="flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{it.productoNombre}</div>
                          </div>
                          <div className="shrink-0 text-right tabular-nums">
                            <div>Recibido: {it.cantidadEnviada}</div>
                            {"cantidadPedida" in it && typeof (it as any).cantidadPedida === "number" ? (
                              <div className="text-xs text-muted-foreground">Pedido: {(it as any).cantidadPedida}</div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
