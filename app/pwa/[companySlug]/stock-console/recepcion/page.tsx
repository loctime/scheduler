"use client"

import { useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, PackageOpen } from "lucide-react"

export default function RecepcionPage() {
  const router = useRouter()
  const { user } = useData()
  const { toast } = useToast()

  const { remitosRecibidos, loading, confirmarRecepcion } = useLogistica(user)

  const [cantidades, setCantidades] = useState<Record<string, Record<string, number>>>({})
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
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

  const remitosEnCamino = remitosRecibidos.filter((r) => r.estado === "en_camino")

  const getCantidad = (remitoId: string, productoId: string, cantidadEnviada: number): number => {
    const remitoMap = cantidades[remitoId]
    if (remitoMap && productoId in remitoMap) {
      return remitoMap[productoId]
    }
    return cantidadEnviada
  }

  const setCantidad = (remitoId: string, productoId: string, value: number) => {
    setCantidades((prev) => ({
      ...prev,
      [remitoId]: {
        ...prev[remitoId],
        [productoId]: value,
      },
    }))
  }

  const handleConfirmar = async (remitoId: string) => {
    const remito = remitosEnCamino.find((r) => r.id === remitoId)
    if (!remito) return

    setConfirmando(remitoId)

    const result = await confirmarRecepcion({
      remitoId: remito.id,
      items: remito.items.map((item) => ({
        productoId: item.productoId,
        productoNombre: item.productoNombre,
        cantidadEnviada: item.cantidadEnviada,
        cantidadRecibida: getCantidad(remito.id, item.productoId, item.cantidadEnviada),
      })),
      observacion: observaciones[remito.id] || undefined,
    })

    if (!mountedRef.current) return
    setConfirmando(null)

    if (result.ok) {
      toast({ title: "Recepción confirmada", description: `Remito de ${remito.origenNombre} recibido correctamente` })
    } else {
      toast({
        title: "Error al confirmar recepción",
        description: result.error ?? "Error desconocido",
        variant: "destructive",
      })
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
        <h1 className="text-base font-medium text-gray-900 flex-1">Recibir pedido</h1>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-8">Cargando remitos…</p>
        )}

        {!loading && remitosEnCamino.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <PackageOpen className="w-12 h-12" />
            <p className="text-sm text-center">No hay pedidos en camino hacia tu sucursal.</p>
          </div>
        )}

        {!loading && remitosEnCamino.map((remito) => (
          <div key={remito.id} className="bg-white rounded-xl border border-[#ebebeb] mb-4 px-4 py-3">
            {/* Card header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{remito.origenNombre}</p>
                <p className="text-xs text-gray-400">Remito #{remito.id.slice(-6)}</p>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                En camino
              </span>
            </div>

            {/* Items */}
            <div className="space-y-3 mb-3">
              {remito.items.map((item) => {
                const cantidad = getCantidad(remito.id, item.productoId, item.cantidadEnviada)
                const hayFaltante = cantidad < item.cantidadEnviada

                return (
                  <div key={item.productoId} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-800">{item.productoNombre}</p>
                      <p className="text-xs text-gray-400">Enviado: {item.cantidadEnviada}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={cantidad}
                        onChange={(e) =>
                          setCantidad(remito.id, item.productoId, Number(e.target.value))
                        }
                        className={`w-24 border rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#1D9E75] ${
                          hayFaltante ? "border-red-400" : "border-gray-200"
                        }`}
                      />
                      {hayFaltante && (
                        <span className="text-amber-500 text-sm" title="Cantidad menor a la enviada">
                          ⚠
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Observaciones */}
            <textarea
              value={observaciones[remito.id] ?? ""}
              onChange={(e) =>
                setObservaciones((prev) => ({ ...prev, [remito.id]: e.target.value }))
              }
              placeholder="Observaciones..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#1D9E75] resize-none mb-3"
            />

            {/* Confirm button */}
            <button
              onClick={() => handleConfirmar(remito.id)}
              disabled={confirmando === remito.id}
              className="w-full py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-medium disabled:opacity-40 active:bg-[#18886B]"
            >
              {confirmando === remito.id ? "Confirmando…" : "Confirmar recepción"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
