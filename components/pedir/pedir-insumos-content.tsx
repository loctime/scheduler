"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCatalogoProductos } from "@/hooks/use-catalogo-productos"
import { useLogistica } from "@/hooks/use-logistica"
import { useToast } from "@/hooks/use-toast"
import { db, COLLECTIONS } from "@/lib/firebase"
import { canUser } from "@/lib/permissions"
import type { PedidoFabricaItem } from "@/lib/logistica-types"
type PuntoDestino = { locationId: string; nombre: string }
export default function PedirInsumosContent({ user, userData }: { user: any; userData: any }) {
  const { toast } = useToast()
  const { crearPedidoFabrica, ownerId, loading: logLoading } = useLogistica(user)
  const { items: catalogo, loadingItems } = useCatalogoProductos(ownerId)

  const [puntos, setPuntos] = useState<PuntoDestino[]>([])
  const [destinoId, setDestinoId] = useState("")
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState(1)
  const [observacion, setObservacion] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [cargandoPuntos, setCargandoPuntos] = useState(true)
  const [pedidos, setPedidos] = useState<Array<{ id: string; nombre: string }>>([])
  const [cargandoPedidos, setCargandoPedidos] = useState(true)

  const puede = useMemo(
    () =>
      canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "crear_pedido") &&
      (userData?.role === "operador" || userData?.role === "admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const origenLocationId = userData?.locationId ?? user?.uid ?? ""
  const origenNombre = userData?.displayName?.trim() || user?.displayName?.trim() || user?.email?.trim() || "Mi sucursal"
  const productos = useMemo(() => catalogo.filter((p) => p.activo), [catalogo])

  const cargarPuntos = useCallback(async () => {
    if (!db || !ownerId) return setCargandoPuntos(false)
    setCargandoPuntos(true)
    try {
      let docs = (await getDocs(query(collection(db, COLLECTIONS.USERS), where("ownerId", "==", ownerId)))).docs
      if (docs.length === 0) {
        const all = await getDocs(collection(db, COLLECTIONS.USERS))
        docs = all.docs.filter((d) => {
          const u = d.data() as Record<string, unknown>
          const oid = u.ownerId as string | undefined
          return oid === ownerId || d.id === ownerId
        })
      }
      const map = new Map<string, string>()
      docs.forEach((d) => {
        const u = d.data() as Record<string, unknown>
        const lid = String(u.locationId ?? u.location ?? d.id)
        const nombre = String(u.displayName ?? u.email ?? lid)
        if (!map.has(lid)) map.set(lid, nombre)
      })
      const list: PuntoDestino[] = [...map.entries()].map(([locationId, nombre]) => ({ locationId, nombre }))
      const fabrica: PuntoDestino = { locationId: ownerId, nombre: "Depósito central (fábrica)" }
      const merged = [fabrica, ...list.filter((p) => p.locationId !== fabrica.locationId)].sort((a, b) => a.nombre.localeCompare(b.nombre))
      setPuntos(merged)
      setDestinoId((prev) => prev || merged.find((p) => p.locationId !== origenLocationId)?.locationId || "")
    } catch {
      setPuntos([{ locationId: ownerId, nombre: "Depósito central (fábrica)" }])
      setDestinoId(ownerId)
    } finally {
      setCargandoPuntos(false)
    }
  }, [ownerId, origenLocationId])

  useEffect(() => { void cargarPuntos() }, [cargarPuntos])

  useEffect(() => {
    const run = async () => {
      if (!db || !ownerId) return setCargandoPedidos(false)
      setCargandoPedidos(true)
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.PEDIDOS), where("ownerId", "==", ownerId)))
        const rows = snap.docs.map((d) => ({ id: d.id, nombre: String((d.data() as any)?.nombre ?? "") })).filter((p) => p.nombre)
        rows.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setPedidos(rows)
      } finally {
        setCargandoPedidos(false)
      }
    }
    void run()
  }, [ownerId])

  const loading = cargandoPuntos || loadingItems || cargandoPedidos || logLoading

  if (!puede) {
    return (
      <Card><CardHeader><CardTitle>Pedir insumos</CardTitle><CardDescription>No tenés permiso para usar esta pantalla.</CardDescription></CardHeader></Card>
    )
  }

  const enviar = async () => {
    const destino = puntos.find((p) => p.locationId === destinoId)
    const producto = productos.find((p) => p.id === productoId)
    if (!destino || !producto) return toast({ title: "Faltan datos", description: "Elegí destino y producto.", variant: "destructive" })
    if (destino.locationId === origenLocationId) return toast({ title: "Destino inválido", description: "El destino debe ser distinto de tu sucursal.", variant: "destructive" })
    if (!Number.isFinite(cantidad) || cantidad < 1) return toast({ title: "Cantidad inválida", description: "Mínimo 1.", variant: "destructive" })
    const grupoPedidoId = (producto.pedidoId ?? "").trim()
    const grupoPedidoNombre = grupoPedidoId ? pedidos.find((p) => p.id === grupoPedidoId)?.nombre ?? "" : ""
    const items: PedidoFabricaItem[] = [{ productoId: producto.id, productoNombre: producto.nombre, cantidadSugerida: 0, cantidadPedida: Math.floor(cantidad) }]
    setEnviando(true)
    const res = await crearPedidoFabrica({ origenLocationId, origenNombre, destinoLocationId: destino.locationId, destinoNombre: destino.nombre, grupoPedidoId, grupoPedidoNombre, items, observacion: observacion.trim() || undefined })
    setEnviando(false)
    if (!res.ok) return toast({ title: "No se pudo enviar", description: res.error, variant: "destructive" })
    toast({ title: "Pedido enviado" })
    setProductoId(""); setCantidad(1); setObservacion("")
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Destino</Label>
          <Select value={destinoId} onValueChange={setDestinoId}>
            <SelectTrigger><SelectValue placeholder="¿A quién le pedís?" /></SelectTrigger>
            <SelectContent>{puntos.filter((p) => p.locationId !== origenLocationId).map((p) => <SelectItem key={p.locationId} value={p.locationId}>{p.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Producto</Label>
          <Select value={productoId} onValueChange={setProductoId}>
            <SelectTrigger><SelectValue placeholder="Elegí un producto" /></SelectTrigger>
            <SelectContent>{productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Cantidad</Label>
          <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        </div>
        <div className="grid gap-2">
          <Label>Observación (opcional)</Label>
          <Textarea rows={1} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </div>
        <Button onClick={() => void enviar()} disabled={loading || enviando || !destinoId || !productoId}>Enviar pedido</Button>
      </CardContent>
    </Card>
  )
}
