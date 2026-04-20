"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { useToast } from "@/hooks/use-toast"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { canUser } from "@/lib/permissions"
import { confirmarMovimientos as confirmarMovimientosService } from "@/src/services/stock/movimientosService"
import type { MovimientoInput } from "@/src/domain/stock/types"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronLeft, Package } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ContarStockPage() {
  const params = useParams()
  const router = useRouter()
  const { user, userData } = useData()
  const { toast } = useToast()
  const companySlug = params.companySlug as string

  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const locationId = userData?.locationId ?? user?.uid ?? ""

  const puedeEditar = useMemo(
    () =>
      canUser(
        { uid: user?.uid, role: userData?.role, locationId: userData?.locationId },
        "editar_stock"
      ),
    [user?.uid, userData?.role, userData?.locationId]
  )

  const { gruposCatalogo } = useGruposCatalogo(ownerId)

  const [filas, setFilas] = useState<StockUbicacion[]>([])
  const [loadingStock, setLoadingStock] = useState(true)
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!db || !ownerId || !locationId) {
      setFilas([])
      setLoadingStock(false)
      return
    }
    setLoadingStock(true)
    const q = query(
      collection(db, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", ownerId),
      where("locationId", "==", locationId)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: StockUbicacion[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>
          return {
            id: d.id,
            ownerId: String(x.ownerId ?? ""),
            catalogoId: String(x.catalogoId ?? ""),
            locationId: String(x.locationId ?? ""),
            nombre: String(x.nombre ?? ""),
            unidad: String(x.unidad ?? "U"),
            pedidoId: String(x.pedidoId ?? ""),
            stockActual: Math.max(0, Math.floor(Number(x.stockActual) || 0)),
            stockMinimo: typeof x.stockMinimo === "number" ? x.stockMinimo : 0,
            orden: typeof x.orden === "number" ? x.orden : 0,
            grupoCatalogoId:
              typeof x.grupoCatalogoId === "string" ? x.grupoCatalogoId : undefined,
            updatedBy: String(x.updatedBy ?? ""),
          }
        })
        setFilas(rows)
        setLoadingStock(false)
      },
      (err) => {
        console.warn("[contar-stock] listener:", err)
        setLoadingStock(false)
      }
    )
    return () => unsub()
  }, [ownerId, locationId])

  const filasPorGrupo = useMemo(() => {
    const m = new Map<string, StockUbicacion[]>()
    for (const f of filas) {
      if (!f.grupoCatalogoId) continue
      if (!m.has(f.grupoCatalogoId)) m.set(f.grupoCatalogoId, [])
      m.get(f.grupoCatalogoId)!.push(f)
    }
    for (const [, rows] of m) {
      rows.sort((a, b) => {
        if ((a.orden ?? 0) !== (b.orden ?? 0)) return (a.orden ?? 0) - (b.orden ?? 0)
        return a.nombre.localeCompare(b.nombre)
      })
    }
    return m
  }, [filas])

  const gruposActivados = useMemo(
    () => gruposCatalogo.filter((g) => filasPorGrupo.has(g.id)),
    [gruposCatalogo, filasPorGrupo]
  )

  useEffect(() => {
    if (gruposActivados.length > 0) {
      setGruposAbiertos((prev) => {
        if (prev.size === 0) return new Set([gruposActivados[0].id])
        return prev
      })
    }
  }, [gruposActivados])

  const toggleGrupo = (id: string) =>
    setGruposAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const incrementar = (id: string) =>
    setCantidades((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }))

  const decrementar = (id: string, stockDisponible: number) =>
    setCantidades((p) => {
      const actual = p[id] ?? 0
      const min = -stockDisponible
      const nuevo = actual - 1
      if (nuevo < min) return p
      return { ...p, [id]: nuevo }
    })

  const hayMovimientos = Object.values(cantidades).some((v) => v !== 0)
  const totalMovimientos = Object.values(cantidades).filter((v) => v !== 0).length

  const limpiar = () => setCantidades({})

  const guardar = async () => {
    if (!puedeEditar) {
      toast({
        title: "Acceso denegado",
        description: "No tenés permisos para editar stock",
        variant: "destructive",
      })
      return
    }
    if (!ownerId || !user?.uid || !locationId) return
    if (!hayMovimientos) return

    const movimientos: MovimientoInput[] = Object.entries(cantidades)
      .filter(([, v]) => v !== 0)
      .map(([productoId, cantidad]) => {
        const fila = filas.find((f) => f.catalogoId === productoId)
        return {
          productoId,
          productoNombre: fila?.nombre ?? "",
          cantidad: Math.abs(cantidad),
          tipo: cantidad > 0 ? "INGRESO" : "EGRESO",
          pedidoId: fila?.pedidoId || undefined,
        }
      })

    setGuardando(true)
    try {
      const res = await confirmarMovimientosService(
        movimientos,
        ownerId,
        user.uid,
        locationId
      )
      if (!res.ok) {
        toast({ title: "Error", description: res.error, variant: "destructive" })
        return
      }
      setCantidades({})
      toast({
        title: "Stock actualizado",
        description: `${movimientos.length} producto${movimientos.length !== 1 ? "s" : ""} actualizado${movimientos.length !== 1 ? "s" : ""}`,
      })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo guardar",
        variant: "destructive",
      })
    } finally {
      setGuardando(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Contar stock</h1>
        {totalMovimientos > 0 && (
          <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
            {totalMovimientos}
          </span>
        )}
      </div>

      <div className="px-4 pt-3 pb-1 shrink-0">
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          Ajustá el número de cada producto al conteo real. Usá + y − para corregir.
        </p>
      </div>

      <div className="flex-1 px-3 py-2 overflow-y-auto space-y-2">
        {loadingStock && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Package className="w-12 h-12 animate-pulse" />
            <p className="text-sm">Cargando stock…</p>
          </div>
        )}

        {!loadingStock && gruposActivados.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 px-6 text-center">
            <Package className="w-12 h-12" />
            <p className="text-sm">
              No tenés grupos activados en esta sucursal. Activá grupos desde Mi stock.
            </p>
          </div>
        )}

        {gruposActivados.map((grupo) => {
          const rows = filasPorGrupo.get(grupo.id) ?? []
          const bajos = rows.filter(
            (f) => f.stockMinimo > 0 && f.stockActual < f.stockMinimo
          ).length
          const isOpen = gruposAbiertos.has(grupo.id)
          const cambiosEnGrupo = rows.filter(
            (f) => (cantidades[f.catalogoId] ?? 0) !== 0
          ).length

          return (
            <div
              key={grupo.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => toggleGrupo(grupo.id)}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50"
              >
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-gray-400 shrink-0 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {grupo.nombre}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {rows.length} producto{rows.length !== 1 ? "s" : ""}
                    {bajos > 0 && (
                      <span className="ml-1 text-red-500">· {bajos} bajo</span>
                    )}
                  </p>
                </div>
                {cambiosEnGrupo > 0 && (
                  <span className="text-[11px] font-medium bg-[#E1F5EE] text-[#0F6E56] px-2 py-0.5 rounded-full shrink-0">
                    {cambiosEnGrupo}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {rows.map((f) => {
                    const cantidad = cantidades[f.catalogoId] ?? 0
                    const nuevoStock = f.stockActual + cantidad
                    const bajo = f.stockMinimo > 0 && nuevoStock < f.stockMinimo
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {f.nombre}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {cantidad !== 0 && (
                              <span>antes {f.stockActual} → </span>
                            )}
                            {nuevoStock} {f.unidad}
                            {f.stockMinimo > 0 && (
                              <span> · mín {f.stockMinimo}</span>
                            )}
                          </p>
                        </div>

                        {bajo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 shrink-0">
                            bajo
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => decrementar(f.catalogoId, f.stockActual)}
                            disabled={guardando}
                            className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 text-lg active:bg-gray-100 disabled:opacity-40"
                          >
                            −
                          </button>
                          <div className="flex flex-col items-center min-w-[2.5rem]">
                            <span
                              className={cn(
                                "text-center text-base font-semibold tabular-nums leading-tight",
                                cantidad > 0 && "text-[#1D9E75]",
                                cantidad < 0 && "text-red-500",
                                cantidad === 0 && "text-gray-800"
                              )}
                            >
                              {nuevoStock}
                            </span>
                            {cantidad !== 0 && (
                              <span
                                className={cn(
                                  "text-[10px] font-medium tabular-nums leading-tight",
                                  cantidad > 0 ? "text-[#1D9E75]" : "text-red-500"
                                )}
                              >
                                {cantidad > 0 ? `+${cantidad}` : cantidad}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => incrementar(f.catalogoId)}
                            disabled={guardando}
                            className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 text-lg active:bg-gray-100 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-2 shrink-0">
        <button
          onClick={limpiar}
          disabled={guardando || !hayMovimientos}
          className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm border border-gray-200 disabled:opacity-40"
        >
          Limpiar
        </button>
        <button
          onClick={guardar}
          disabled={guardando || !hayMovimientos}
          className="flex-1 py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed active:bg-[#18886B]"
        >
          {guardando
            ? "Guardando…"
            : hayMovimientos
            ? `Guardar (${totalMovimientos} producto${totalMovimientos !== 1 ? "s" : ""})`
            : "Guardar stock"}
        </button>
      </div>
    </div>
  )
}
