"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VENCAPP_STATUS_COLORS } from "@/lib/vencapp-constants"
import { getLotStatus } from "@/lib/vencapp-status"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"

interface ZoneSheetProps {
  zone: WarehouseZone | null
  lots: Lot[]
  products: Producto[]
  onClose: () => void
  onEnter: () => void
  onDelete: () => void
}

export function ZoneSheet({ zone, lots, products, onClose, onEnter, onDelete }: ZoneSheetProps) {
  return (
    <Sheet open={!!zone} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{zone?.name ?? "Zona"}</SheetTitle>
        </SheetHeader>
        {zone && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Badge variant="outline" className="border-gray-300 text-gray-700">
                {zone.type}
              </Badge>
              <span>{lots.length} lotes</span>
            </div>

            <div className="space-y-2">
              {lots.map((lot) => {
                const product = products.find((p) => p.id === lot.productId)
                const status = getLotStatus(lot.expiryDate)
                return (
                  <div key={lot.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{product?.nombre ?? "Producto"}</div>
                        <div className="text-xs text-gray-600">
                          {lot.quantity} u · vence {lot.expiryDate}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-2 py-1 text-xs font-semibold"
                        style={{ backgroundColor: `${VENCAPP_STATUS_COLORS[status]}20`, color: VENCAPP_STATUS_COLORS[status] }}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                )
              })}
              {lots.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                  No hay lotes asignados.
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {zone.type !== "estante" && (
                <Button type="button" variant="outline" onClick={onEnter} className="h-10">
                  Entrar →
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onDelete} className="h-10 border-red-200 text-red-600">
                Eliminar zona
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

