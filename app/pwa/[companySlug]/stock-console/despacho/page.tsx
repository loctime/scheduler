"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, Truck } from "lucide-react"
import type { PedidoFabrica } from "@/lib/logistica-types"

const ESTADOS_ACTIVOS = new Set(["enviado", "en_preparacion", "despachado"])

export default function DespacharPage() {
  const router = useRouter()
  const { user, userData } = useData()
  const { toast } = useToast()

  const { pedidosParaMi, loading, locationId, crearRemito, marcarEnCamino } = useLogistica(user)

  const [despachando, setDespachando] = useState<string | null>(null)
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

  const pedidosActivos = pedidosParaMi.filter((p) => ESTADOS_ACTIVOS.has(p.estado))
  const listos = pedidosActivos.filter((p) => p.estado === "enviado" || p.estado === "en_preparacion")
  const enCamino = pedidosActivos.filter((p) => p.estado === "despachado")

  const handleDespachar = async (pedido: PedidoFabrica) => {
    if (!locationId) {
      toast({ title: "Error", description: "Sin ubicación configurada", variant: "destructive" })
      return
    }

    const items = pedido.items.map((item) => ({
      productoId: item.productoId,
      productoNombre: item.productoNombre,
      cantidadEnviada: item.cantidadPedida,
      cantidadPedida: item.cantidadPedida,
    }))

    setDespachando(pedido.id)
    const remitoResult = await crearRemito({
      pedidoFabricaId: pedido.id,
      origenLocationId: locationId,
      origenNombre: userData?.locationName ?? locationId,
      destinoLocationId: pedido.origenLocationId,
      destinoNombre: pedido.origenNombre,
      items,
    })

    if (!mountedRef.current) return

    if (!remitoResult.ok) {
      setDespachando(null)
      toast({ title: "Error al despachar", description: remitoResult.error ?? "Error desconocido", variant: "destructive" })
      return
    }

    const enCaminoResult = await marcarEnCamino(remitoResult.remitoId!)

    if (!mountedRef.current) return
    setDespachando(null)

    if (!enCaminoResult.ok) {
      toast({ title: "Error", description: enCaminoResult.error ?? "No se pudo marcar en camino", variant: "destructive" })
      return
    }

    toast({ title: "Remito despachado", description: `Pedido de ${pedido.origenNombre} marcado como en camino` })
  }

  const totalActivos = pedidosActivos.length
  const totalDespachados = enCamino.length

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
        <h1 className="text-base font-medium text-gray-900 flex-1">Despachar pedidos</h1>
        {totalActivos > 0 && (
          <span className="text-xs font-medium bg-[#E1F5EE] text-[#0F6E56] px-2.5 py-1 rounded-full">
            Hoy · {totalActivos} pedidos
          </span>
        )}
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando pedidos…</p>
        )}

        {!loading && pedidosActivos.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <Truck className="w-12 h-12" />
            <p className="text-sm text-center">No hay pedidos para despachar.</p>
          </div>
        )}

        {!loading && pedidosActivos.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Pedidos del día
            </p>

            {[...listos, ...enCamino].map((pedido) => {
              const isListo = pedido.estado === "enviado" || pedido.estado === "en_preparacion"
              const resumen = pedido.items
                .map((i) => `${i.productoNombre} ×${i.cantidadPedida}`)
                .join(" · ")

              return (
                <div
                  key={pedido.id}
                  className="bg-white rounded-xl border border-[#ebebeb] mb-3 px-4 py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{pedido.origenNombre}</p>
                    {isListo ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E1F5EE] text-[#0F6E56]">
                        Listo para despachar
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        En camino
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{resumen}</p>
                  {isListo && (
                    <button
                      onClick={() => handleDespachar(pedido)}
                      disabled={despachando === pedido.id}
                      className="w-full py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
                    >
                      {despachando === pedido.id ? "Despachando…" : "Marcar como despachado"}
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Footer counter */}
      {totalActivos > 0 && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 text-center shrink-0">
          <p className="text-sm text-gray-400">
            {totalDespachados} de {totalActivos} remitos despachados
          </p>
        </div>
      )}
    </div>
  )
}
