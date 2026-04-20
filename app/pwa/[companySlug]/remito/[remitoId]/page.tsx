"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { ChevronLeft, Printer } from "lucide-react"
import type { RemitoLog, RecepcionLog } from "@/lib/logistica-types"

function formatFecha(ts: unknown): string {
  try {
    const d = typeof (ts as any)?.toDate === "function"
      ? (ts as any).toDate()
      : new Date((ts as any)?.seconds * 1000)
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return "—"
  }
}

function formatFechaHora(ts: unknown): string {
  try {
    const d = typeof (ts as any)?.toDate === "function"
      ? (ts as any).toDate()
      : new Date((ts as any)?.seconds * 1000)
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export default function RemitoPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useData()
  const remitoId = params.remitoId as string

  const [remito, setRemito] = useState<RemitoLog | null>(null)
  const [recepcion, setRecepcion] = useState<RecepcionLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db || !remitoId) return
    setLoading(true)

    async function fetchData() {
      try {
        // Fetch remito
        const rRef = doc(db!, COLLECTIONS.REMITOS_LOG, remitoId)
        const rSnap = await getDoc(rRef)
        if (!rSnap.exists()) {
          setError("Remito no encontrado")
          setLoading(false)
          return
        }
        const rData = rSnap.data() as Record<string, unknown>
        setRemito({
          id: rSnap.id,
          ownerId: String(rData.ownerId ?? ""),
          numero: String(rData.numero ?? ""),
          origenLocationId: String(rData.origenLocationId ?? ""),
          origenNombre: String(rData.origenNombre ?? ""),
          destinoLocationId: String(rData.destinoLocationId ?? ""),
          destinoNombre: String(rData.destinoNombre ?? ""),
          pedidoFabricaId: rData.pedidoFabricaId ? String(rData.pedidoFabricaId) : undefined,
          estado: rData.estado as RemitoLog["estado"],
          items: (rData.items as RemitoLog["items"]) ?? [],
          observacion: rData.observacion ? String(rData.observacion) : undefined,
          creadoEn: rData.creadoEn,
          creadoPor: String(rData.creadoPor ?? ""),
          creadoPorEmail: String(rData.creadoPorEmail ?? ""),
          actualizadoEn: rData.actualizadoEn,
          stockDescontadoEn: rData.stockDescontadoEn,
          statusHistory: (rData.statusHistory as RemitoLog["statusHistory"]) ?? [],
        })

        // Fetch recepcion log for this remito (if exists)
        const recQ = query(
          collection(db!, COLLECTIONS.RECEPCIONES_LOG ?? "recepciones_log"),
          where("remitoId", "==", remitoId)
        )
        const recSnap = await getDocs(recQ)
        if (!recSnap.empty) {
          const recData = recSnap.docs[0].data() as Record<string, unknown>
          setRecepcion({
            id: recSnap.docs[0].id,
            ownerId: String(recData.ownerId ?? ""),
            remitoId: String(recData.remitoId ?? ""),
            remitoNumero: String(recData.remitoNumero ?? ""),
            origenLocationId: String(recData.origenLocationId ?? ""),
            destinoLocationId: String(recData.destinoLocationId ?? ""),
            destinoNombre: String(recData.destinoNombre ?? ""),
            items: (recData.items as RecepcionLog["items"]) ?? [],
            observacion: recData.observacion ? String(recData.observacion) : undefined,
            creadoEn: recData.creadoEn,
            creadoPor: String(recData.creadoPor ?? ""),
            creadoPorEmail: String(recData.creadoPorEmail ?? ""),
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar el remito")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [remitoId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 text-sm">
        Cargando remito…
      </div>
    )
  }

  if (error || !remito) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400 text-sm">
        {error ?? "Remito no encontrado"}
      </div>
    )
  }

  const recepcionByProducto = new Map(
    (recepcion?.items ?? []).map((i) => [i.productoId, i])
  )

  const estadoBadge = {
    preparado: { label: "Preparado", cls: "bg-amber-50 text-amber-700" },
    en_camino: { label: "En camino", cls: "bg-blue-50 text-blue-700" },
    entregado: { label: "Entregado", cls: "bg-[#E1F5EE] text-[#0F6E56]" },
    cancelado: { label: "Cancelado", cls: "bg-red-50 text-red-600" },
  }[remito.estado] ?? { label: remito.estado, cls: "bg-gray-100 text-gray-500" }

  const observacionDespacho = remito.observacion
  const observacionRecepcion = recepcion?.observacion

  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 print:hidden">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">{remito.numero}</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>

      {/* Remito card */}
      <div className="px-4 py-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden print:border-none print:rounded-none print:shadow-none">

          {/* Remito header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xl font-bold text-gray-900 tracking-tight">{remito.numero}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatFecha(remito.creadoEn)}</p>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${estadoBadge.cls}`}>
                {estadoBadge.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">De</p>
                <p className="text-sm font-medium text-gray-900">{remito.origenNombre}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Para</p>
                <p className="text-sm font-medium text-gray-900">{remito.destinoNombre}</p>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="px-6 py-4">
            {/* Table header */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-1">
              <p className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Producto</p>
              <p className="w-16 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Pedido</p>
              <p className="w-16 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Enviado</p>
              {recepcion && (
                <p className="w-16 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Recibido</p>
              )}
            </div>

            {remito.items.map((item) => {
              const rec = recepcionByProducto.get(item.productoId)
              const hayDiferencia = rec && rec.cantidadRecibida !== item.cantidadEnviada
              return (
                <div
                  key={item.productoId}
                  className={`flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-b-0 ${hayDiferencia ? "bg-amber-50 -mx-2 px-2 rounded" : ""}`}
                >
                  <p className="flex-1 text-sm text-gray-800">{item.productoNombre}</p>
                  <p className="w-16 text-center text-sm text-gray-500">{item.cantidadPedida ?? "—"}</p>
                  <p className="w-16 text-center text-sm font-medium text-gray-800">{item.cantidadEnviada}</p>
                  {recepcion && (
                    <p className={`w-16 text-center text-sm font-medium ${hayDiferencia ? "text-amber-700" : "text-[#0F6E56]"}`}>
                      {rec?.cantidadRecibida ?? "—"}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Observations */}
          {(observacionDespacho || observacionRecepcion) && (
            <div className="px-6 pb-4 space-y-3 border-t border-gray-100 pt-4">
              {observacionDespacho && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Obs. envío</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{observacionDespacho}</p>
                </div>
              )}
              {observacionRecepcion && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Obs. recepción</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{observacionRecepcion}</p>
                </div>
              )}
            </div>
          )}

          {/* Status history */}
          {remito.statusHistory.length > 0 && (
            <div className="px-6 pb-5 border-t border-gray-100 pt-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Historial</p>
              <div className="space-y-2">
                {remito.statusHistory.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 capitalize">{entry.status.replace("_", " ")}</p>
                      <p className="text-[10px] text-gray-400">{formatFechaHora(entry.timestamp)} · {entry.userName}</p>
                      {entry.nota && <p className="text-[10px] text-gray-500 mt-0.5">{entry.nota}</p>}
                    </div>
                  </div>
                ))}
                {recepcion && (
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#0F6E56] font-medium">Recibido en {remito.destinoNombre}</p>
                      <p className="text-[10px] text-gray-400">{formatFechaHora(recepcion.creadoEn)} · {recepcion.creadoPorEmail}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
