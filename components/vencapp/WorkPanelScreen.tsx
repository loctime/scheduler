"use client"

import { useEffect, useMemo, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { VENCAPP_STATUS_COLORS } from "@/lib/vencapp-constants"
import { countLotsByStatus, getLotDaysRemaining, getLotStatus, getProductStatus } from "@/lib/vencapp-status"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"

interface WorkPanelScreenProps {
  productos: Producto[]
  lots: Lot[]
  zones: WarehouseZone[]
  loading: boolean
  addLot: (input: Omit<Lot, "id" | "ownerId" | "userId" | "createdAt" | "updatedAt">) => Promise<any>
  updateLot: (lotId: string, data: Partial<Lot>) => Promise<any>
  removeLot: (lotId: string) => Promise<any>
  focusProductId?: string | null
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function WorkPanelScreen({
  productos,
  lots,
  zones,
  loading,
  addLot,
  updateLot,
  removeLot,
  focusProductId,
}: WorkPanelScreenProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!focusProductId) return
    setOpenIds((prev) => new Set(prev).add(focusProductId))
  }, [focusProductId])

  const sortedProducts = useMemo(() => {
    return [...productos].sort((a, b) => {
      const statusA = getProductStatus(a.id, lots)
      const statusB = getProductStatus(b.id, lots)
      const priority = { danger: 0, warn: 1, ok: 2, empty: 3 }
      return (priority[statusA] ?? 3) - (priority[statusB] ?? 3)
    })
  }, [productos, lots])

  const counters = useMemo(() => countLotsByStatus(lots), [lots])

  const zonesById = useMemo(() => {
    const map: Record<string, WarehouseZone> = {}
    zones.forEach((zone) => {
      map[zone.id] = zone
    })
    return map
  }, [zones])

  const handleAddLot = async (productId: string) => {
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 30)
    await addLot({
      productId,
      quantity: 1,
      expiryDate: formatDateInput(defaultDate),
      locationId: null,
      note: "",
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          Urgentes: <span className="font-semibold text-red-600">{counters.danger}</span>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          Próx 30d: <span className="font-semibold text-amber-700">{counters.warn}</span>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          OK: <span className="font-semibold text-green-700">{counters.ok}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {sortedProducts.map((product) => {
          const status = getProductStatus(product.id, lots)
          const borderColor = VENCAPP_STATUS_COLORS[status]
          const productLots = lots.filter((lot) => lot.productId === product.id)
          const isOpen = openIds.has(product.id)

          return (
            <Collapsible
              key={product.id}
              open={isOpen}
              onOpenChange={(open) => {
                setOpenIds((prev) => {
                  const next = new Set(prev)
                  if (open) next.add(product.id)
                  else next.delete(product.id)
                  return next
                })
              }}
              className="rounded-xl border border-gray-200 bg-white"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-10 w-1.5 rounded-full" style={{ backgroundColor: borderColor }} />
                    <div>
                      <div className="text-sm font-semibold">{product.nombre}</div>
                      <div className="text-xs text-gray-500">{productLots.length} lotes</div>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${borderColor}20`, color: borderColor }}
                  >
                    {status === "danger" ? "Urgente" : status === "warn" ? "Próximo" : status === "ok" ? "OK" : "Sin lotes"}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-gray-200 px-4 pb-4 pt-3">
                <div className="space-y-3">
                  {productLots.map((lot) => {
                    const lotStatus = getLotStatus(lot.expiryDate)
                    const daysRemaining = getLotDaysRemaining(lot.expiryDate)
                    const lotColor = VENCAPP_STATUS_COLORS[lotStatus]
                    const zoneName = lot.locationId ? zonesById[lot.locationId]?.name ?? "" : ""

                    return (
                      <div key={lot.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-gray-300 text-gray-700">
                                Cantidad
                              </Badge>
                              <Input
                                type="number"
                                min={0}
                                value={lot.quantity}
                                onChange={(e) => updateLot(lot.id, { quantity: Number(e.target.value || 0) })}
                                className="h-10 w-24 border-gray-200 text-center"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-gray-300 text-gray-700">
                                Vence
                              </Badge>
                              <Input
                                type="date"
                                value={lot.expiryDate}
                                onChange={(e) => updateLot(lot.id, { expiryDate: e.target.value })}
                                className="h-10 border-gray-200"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-gray-300 text-gray-700">
                                Ubicación
                              </Badge>
                              <Input
                                value={zoneName}
                                readOnly
                                className="h-10 border-gray-200"
                                placeholder="Sin ubicación"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className="rounded-full px-2 py-1 text-xs font-semibold"
                              style={{ backgroundColor: `${lotColor}20`, color: lotColor }}
                            >
                              {daysRemaining} días
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 border-gray-200 text-xs"
                              onClick={() => removeLot(lot.id)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full border-dashed border-gray-300 text-sm"
                    onClick={() => handleAddLot(product.id)}
                    disabled={loading}
                  >
                    + Agregar lote
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
        {!loading && productos.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No hay productos disponibles.
          </div>
        )}
      </div>
    </div>
  )
}

