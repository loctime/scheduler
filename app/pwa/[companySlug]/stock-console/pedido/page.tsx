"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ClipboardList } from "lucide-react"
import type { PedidoFabricaItem } from "@/lib/logistica-types"

function esDeHoy(creadoEn: unknown): boolean {
  try {
    const ts = creadoEn as any
    const date = typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts?.seconds * 1000)
    const hoy = new Date()
    return (
      date.getDate() === hoy.getDate() &&
      date.getMonth() === hoy.getMonth() &&
      date.getFullYear() === hoy.getFullYear()
    )
  } catch {
    return false
  }
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  enviado: { label: "Enviado", cls: "bg-[#E1F5EE] text-[#0F6E56]" },
  en_preparacion: { label: "En preparación", cls: "bg-blue-50 text-blue-700" },
  despachado: { label: "Despachado", cls: "bg-blue-50 text-blue-700" },
  recibido: { label: "Recibido", cls: "bg-gray-100 text-gray-500" },
  cancelado: { label: "Cancelado", cls: "bg-red-50 text-red-600" },
  borrador: { label: "Pendiente", cls: "bg-amber-50 text-amber-700" },
}

export default function VerPedidoPage() {
  const router = useRouter()
  const { user } = useData()
  const { toast } = useToast()

  const { pedidosPropios, loading, crearPedidoFabrica } = useLogistica(user)

  // cantidades editables: pedidoId → productoId → cantidad
  const [cantidades, setCantidades] = useState<Record<string, Record<string, number>>>({})
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState<string | null>(null)
  // IDs de borradores ya enviados (ocultar localmente hasta que el listener los limpie)
  const [enviados_ids, setEnviadosIds] = useState<Set<string>>(new Set())
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

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

  // Borradores: show all regardless of date (don't lose pending orders across days)
  const borradores = pedidosPropios.filter((p) => p.estado === "borrador" && !enviados_ids.has(p.id))
  // Sent orders: show today's history only
  const enviados = pedidosPropios.filter((p) => p.estado !== "borrador" && esDeHoy(p.creadoEn))

  const getCantidad = (pedidoId: string, productoId: string, fallback: number) =>
    cantidades[pedidoId]?.[productoId] ?? fallback

  const setCantidadItem = (pedidoId: string, productoId: string, value: number) => {
    setCantidades((prev) => ({
      ...prev,
      [pedidoId]: { ...(prev[pedidoId] ?? {}), [productoId]: Math.max(0, value) },
    }))
  }

  const handleEnviar = async (pedidoId: string) => {
    const pedido = borradores.find((p) => p.id === pedidoId)
    if (!pedido) return

    const items: PedidoFabricaItem[] = pedido.items.map((item) => ({
      productoId: item.productoId,
      productoNombre: item.productoNombre,
      cantidadSugerida: item.cantidadSugerida,
      cantidadPedida: getCantidad(pedidoId, item.productoId, item.cantidadPedida),
    }))

    const itemsValidos = items.filter((i) => i.cantidadPedida > 0)
    if (itemsValidos.length === 0) {
      toast({ title: "Error", description: "Ingresá al menos un ítem con cantidad mayor a 0", variant: "destructive" })
      return
    }

    setEnviando(pedidoId)
    const result = await crearPedidoFabrica({
      origenLocationId: pedido.origenLocationId,
      origenNombre: pedido.origenNombre,
      destinoLocationId: pedido.destinoLocationId,
      destinoNombre: pedido.destinoNombre,
      grupoPedidoId: pedido.grupoPedidoId,
      grupoPedidoNombre: pedido.grupoPedidoNombre,
      items: itemsValidos,
      observacion: observaciones[pedidoId]?.trim() || undefined,
    })

    if (!mountedRef.current) return
    setEnviando(null)

    if (result.ok) {
      // Ocultar el borrador localmente mientras el listener de Firestore se actualiza
      setEnviadosIds((prev) => new Set([...prev, pedidoId]))
      toast({ title: "Pedido enviado", description: `Pedido a ${pedido.destinoNombre} enviado correctamente` })
    } else {
      toast({ title: "Error", description: result.error ?? "No se pudo enviar el pedido", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-medium text-gray-900 flex-1">Pedido del día</h1>
        <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
          Hoy
        </span>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando pedidos…</p>
        )}

        {!loading && borradores.length === 0 && enviados.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <ClipboardList className="w-12 h-12" />
            <p className="text-sm text-center">
              No hay pedidos hoy.
              <br />
              El pedido se genera automáticamente al recibir con faltantes.
            </p>
          </div>
        )}

        {/* Borradores: editables y enviables */}
        {!loading && borradores.map((pedido) => (
          <div key={pedido.id} className="bg-white rounded-xl border border-[#ebebeb] mb-3 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{pedido.destinoNombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pedido.grupoPedidoNombre}</p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                Pendiente de envío
              </span>
            </div>

            {/* Info */}
            <div className="px-4 py-2">
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Cantidades calculadas según tu stock. Podés ajustar antes de enviar.
              </p>
            </div>

            {/* Item table */}
            <div className="px-4 pb-2">
              <div className="flex text-[11px] text-gray-400 uppercase tracking-wide py-1.5 gap-2">
                <span className="flex-1">Producto</span>
                <span className="w-16 text-center">Sugerido</span>
                <span className="w-24 text-center">Enviar</span>
              </div>
              {pedido.items.map((item) => {
                const cant = getCantidad(pedido.id, item.productoId, item.cantidadPedida)
                return (
                  <div key={item.productoId} className="flex items-center gap-2 py-2 border-t border-gray-50">
                    <span className="flex-1 text-sm text-gray-800 truncate">{item.productoNombre}</span>
                    <span className="w-16 text-center text-sm text-gray-400">{item.cantidadSugerida}</span>
                    <div className="w-24 flex items-center gap-1 justify-center">
                      <button
                        onClick={() => setCantidadItem(pedido.id, item.productoId, cant - 1)}
                        className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-sm flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className={`w-7 text-center text-sm font-semibold ${cant !== item.cantidadPedida ? "text-[#1D9E75]" : "text-gray-800"}`}>
                        {cant}
                      </span>
                      <button
                        onClick={() => setCantidadItem(pedido.id, item.productoId, cant + 1)}
                        className="w-6 h-6 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-sm flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Observaciones */}
            <div className="px-4 pb-2">
              <textarea
                value={observaciones[pedido.id] ?? ""}
                onChange={(e) => setObservaciones((prev) => ({ ...prev, [pedido.id]: e.target.value }))}
                placeholder="Observaciones (opcional)..."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1D9E75] resize-none"
              />
            </div>

            {/* Send button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => handleEnviar(pedido.id)}
                disabled={enviando === pedido.id}
                className="w-full py-2.5 rounded-xl bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
              >
                {enviando === pedido.id ? "Enviando…" : "Enviar pedido"}
              </button>
            </div>
          </div>
        ))}

        {/* Already sent: read-only */}
        {!loading && enviados.map((pedido) => {
          const badge = ESTADO_BADGE[pedido.estado] ?? { label: pedido.estado, cls: "bg-gray-100 text-gray-500" }
          return (
            <div key={pedido.id} className="bg-white rounded-xl border border-[#ebebeb] mb-3 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{pedido.destinoNombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pedido.grupoPedidoNombre}</p>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-400">
                  {pedido.items.map((i) => `${i.productoNombre} ×${i.cantidadPedida}`).join(" · ")}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
