"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCatalogoProductos } from "@/hooks/use-catalogo-productos"
import { useLogistica } from "@/hooks/use-logistica"
import { useToast } from "@/hooks/use-toast"
import { db, COLLECTIONS } from "@/lib/firebase"
import { canUser } from "@/lib/permissions"
import type { PedidoFabricaItem } from "@/lib/logistica-types"
type PuntoDestino = { locationId: string; nombre: string }

type ItemSeleccionado = {
  productoId: string
  productoNombre: string
  cantidad: number
}
export default function PedirInsumosContent({ user, userData }: { user: any; userData: any }) {
  const { toast } = useToast()
  const { crearPedidoFabrica, ownerId, loading: logLoading } = useLogistica(user)
  const { items: catalogo, loadingItems } = useCatalogoProductos(ownerId)

  const [puntos, setPuntos] = useState<PuntoDestino[]>([])
  const [destinoId, setDestinoId] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaAbierta, setBusquedaAbierta] = useState(false)
  const [itemsSeleccionados, setItemsSeleccionados] = useState<ItemSeleccionado[]>([])
  const [observacion, setObservacion] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [cargandoPuntos, setCargandoPuntos] = useState(true)
  const [pedidos, setPedidos] = useState<Array<{ id: string; nombre: string }>>([])
  const [cargandoPedidos, setCargandoPedidos] = useState(true)
  const contenedorBusquedaRef = useRef<HTMLDivElement | null>(null)

  const puede = useMemo(
    () =>
      canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "crear_pedido") &&
      (userData?.role === "operador" || userData?.role === "admin"),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const origenLocationId = userData?.locationId ?? user?.uid ?? ""
  const origenNombre = userData?.displayName?.trim() || user?.displayName?.trim() || user?.email?.trim() || "Mi sucursal"
  const productos = useMemo(() => catalogo.filter((p) => p.activo), [catalogo])
  const productosPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    const out = productos
      .filter((p) => p.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
    return out.slice(0, 30)
  }, [busqueda, productos])

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

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!contenedorBusquedaRef.current) return
      const target = e.target as Node | null
      if (!target) return
      if (!contenedorBusquedaRef.current.contains(target)) setBusquedaAbierta(false)
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [])

  const loading = cargandoPuntos || loadingItems || cargandoPedidos || logLoading

  if (!puede) {
    return (
      <div className="rounded-lg border bg-background p-4">
        <div className="text-base font-semibold">Pedir insumos</div>
        <div className="mt-1 text-sm text-muted-foreground">No tenés permiso para usar esta pantalla.</div>
      </div>
    )
  }

  const agregarProducto = (productoId: string) => {
    const prod = productosPorId.get(productoId)
    if (!prod) return
    setItemsSeleccionados((prev) => {
      const idx = prev.findIndex((x) => x.productoId === productoId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: Math.max(1, Math.floor((next[idx].cantidad ?? 0) + 1)) }
        return next
      }
      return [...prev, { productoId: prod.id, productoNombre: prod.nombre, cantidad: 1 }]
    })
    setBusqueda("")
    setBusquedaAbierta(false)
  }

  const actualizarCantidad = (productoId: string, cantidadNueva: number) => {
    setItemsSeleccionados((prev) =>
      prev.map((it) =>
        it.productoId === productoId ? { ...it, cantidad: Math.max(1, Math.floor(cantidadNueva || 1)) } : it
      )
    )
  }

  const eliminarProducto = (productoId: string) => {
    setItemsSeleccionados((prev) => prev.filter((x) => x.productoId !== productoId))
  }

  const enviar = async () => {
    const destino = puntos.find((p) => p.locationId === destinoId)
    if (!destino) {
      return toast({ title: "Faltan datos", description: "Elegí un destino.", variant: "destructive" })
    }
    if (!itemsSeleccionados.length) {
      return toast({ title: "Faltan datos", description: "Agregá al menos un producto.", variant: "destructive" })
    }
    if (destino.locationId === origenLocationId) return toast({ title: "Destino inválido", description: "El destino debe ser distinto de tu sucursal.", variant: "destructive" })
    for (const it of itemsSeleccionados) {
      if (!Number.isFinite(it.cantidad) || it.cantidad < 1) {
        return toast({ title: "Cantidad inválida", description: `Mínimo 1 para ${it.productoNombre}.`, variant: "destructive" })
      }
    }

    const grupoIds = Array.from(
      new Set(
        itemsSeleccionados
          .map((it) => (productosPorId.get(it.productoId)?.pedidoId ?? "").trim())
          .filter(Boolean)
      )
    )
    const grupoPedidoId = grupoIds.length === 1 ? grupoIds[0] : ""
    const grupoPedidoNombre = grupoPedidoId ? pedidos.find((p) => p.id === grupoPedidoId)?.nombre ?? "" : ""
    const items: PedidoFabricaItem[] = itemsSeleccionados.map((it) => ({
      productoId: it.productoId,
      productoNombre: it.productoNombre,
      cantidadSugerida: 0,
      cantidadPedida: Math.floor(it.cantidad),
    }))
    setEnviando(true)
    const res = await crearPedidoFabrica({ origenLocationId, origenNombre, destinoLocationId: destino.locationId, destinoNombre: destino.nombre, grupoPedidoId, grupoPedidoNombre, items, observacion: observacion.trim() || undefined })
    setEnviando(false)
    if (!res.ok) return toast({ title: "No se pudo enviar", description: res.error, variant: "destructive" })
    toast({ title: "Pedido enviado" })
    setItemsSeleccionados([])
    setObservacion("")
    setBusqueda("")
    setBusquedaAbierta(false)
  }

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="rounded-lg border bg-background p-4">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-sm font-medium">Destino</div>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="¿A quién le pedís?" />
              </SelectTrigger>
              <SelectContent>
                {puntos
                  .filter((p) => p.locationId !== origenLocationId)
                  .map((p) => (
                    <SelectItem key={p.locationId} value={p.locationId}>
                      {p.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-sm font-medium">Buscador de productos</div>
            <div ref={contenedorBusquedaRef} className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M21 21l-4.35-4.35"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <input
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setBusquedaAbierta(true)
                }}
                onFocus={() => setBusquedaAbierta(true)}
                placeholder={loading ? "Cargando productos..." : "Escribí para buscar..."}
                disabled={loading}
                className="h-10 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />

              {busquedaAbierta && busqueda.trim() && (
                <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-md border bg-background shadow-sm">
                  {productosFiltrados.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No hay resultados</div>
                  ) : (
                    <div className="max-h-64 overflow-auto py-1">
                      {productosFiltrados.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => agregarProducto(p.id)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {p.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium">Artículos seleccionados</div>
          <div className="mt-2 overflow-hidden rounded-lg border">
            {itemsSeleccionados.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">Aún no agregaste productos</div>
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_120px_40px] gap-2 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>Producto</div>
                  <div className="text-right">Cantidad</div>
                  <div className="text-right" aria-hidden="true">
                    &nbsp;
                  </div>
                </div>
                {itemsSeleccionados.map((it, idx) => (
                  <div
                    key={it.productoId}
                    className={[
                      "grid grid-cols-[1fr_120px_40px] items-center gap-2 px-4 py-2",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                    ].join(" ")}
                  >
                    <div className="min-w-0 truncate text-sm">{it.productoNombre}</div>
                    <div className="flex justify-end">
                      <input
                        type="number"
                        min={1}
                        value={it.cantidad}
                        onChange={(e) => actualizarCantidad(it.productoId, Number(e.target.value))}
                        className="h-9 w-24 rounded-md border bg-background px-2 text-right text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => eliminarProducto(it.productoId)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground hover:bg-muted"
                        aria-label={`Eliminar ${it.productoNombre}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="text-sm font-medium">Observación (opcional)</div>
        <textarea
          rows={2}
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          placeholder="Escribí una nota si hace falta…"
          className="mt-2 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={loading || enviando || !destinoId || itemsSeleccionados.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Enviar pedido"}
        </button>
      </div>
    </div>
  )
}
