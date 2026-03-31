"use client"

import { useMemo } from "react"
import { VENCAPP_STATUS_COLORS } from "@/lib/vencapp-constants"
import { countLotsByStatus, getLotStatus, getProductById, getZoneStatus } from "@/lib/vencapp-status"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"

interface DashboardScreenProps {
  productos: Producto[]
  lots: Lot[]
  zones: WarehouseZone[]
}

export function DashboardScreen({ productos, lots, zones }: DashboardScreenProps) {
  const counters = useMemo(() => countLotsByStatus(lots), [lots])

  const alerts = useMemo(() => {
    return [...lots]
      .filter((lot) => {
        const status = getLotStatus(lot.expiryDate)
        return status === "danger" || status === "warn"
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
  }, [lots])

  const timeline = useMemo(() => {
    return [...lots].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
  }, [lots])

  const zonesTop = useMemo(() => zones.filter((zone) => !zone.parentId), [zones])

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Lotes urgentes</div>
          <div className="mt-2 text-2xl font-semibold text-red-600">{counters.danger}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Vencen en 30d</div>
          <div className="mt-2 text-2xl font-semibold text-amber-700">{counters.warn}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Total productos</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{productos.length}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold">Alertas</div>
          <div className="mt-3 space-y-2">
            {alerts.map((lot) => {
              const product = getProductById(productos, lot.productId)
              const status = getLotStatus(lot.expiryDate)
              const color = VENCAPP_STATUS_COLORS[status]
              return (
                <div key={lot.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <div>
                    <div className="font-semibold">{product?.nombre ?? "Producto"}</div>
                    <div className="text-xs text-gray-600">
                      {lot.quantity} u · vence {lot.expiryDate}
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: `${color}20`, color }}>
                    {status}
                  </span>
                </div>
              )
            })}
            {alerts.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500">
                Sin alertas.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold">Mini mapa</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {zonesTop.map((zone) => {
              const status = getZoneStatus(zone.id, zones, lots)
              const color = VENCAPP_STATUS_COLORS[status]
              return (
                <div key={zone.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs font-semibold">{zone.name}</div>
                  <div className="mt-2 h-2 w-full rounded-full" style={{ backgroundColor: `${color}40` }} />
                </div>
              )
            })}
            {zonesTop.length === 0 && (
              <div className="col-span-2 rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500">
                Sin zonas creadas.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold">Próximos vencimientos</div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {timeline.map((lot) => {
            const product = getProductById(productos, lot.productId)
            const status = getLotStatus(lot.expiryDate)
            const color = VENCAPP_STATUS_COLORS[status]
            return (
              <div key={lot.id} className="min-w-[180px] rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500">{lot.expiryDate}</div>
                <div className="mt-1 text-sm font-semibold">{product?.nombre ?? "Producto"}</div>
                <div className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${color}20`, color }}>
                  {status}
                </div>
              </div>
            )
          })}
          {timeline.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500">
              No hay lotes cargados.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

