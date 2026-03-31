"use client"

import { CSS } from "@dnd-kit/utilities"
import { useDraggable } from "@dnd-kit/core"
import { VENCAPP_STATUS_COLORS } from "@/lib/vencapp-constants"
import { getLotStatus } from "@/lib/vencapp-status"
import type { Lot, Producto } from "@/lib/types"

function DraggableLotCard({ lot, productName }: { lot: Lot; productName: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lot.id,
    data: { lotId: lot.id },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  }

  const status = getLotStatus(lot.expiryDate)
  const color = VENCAPP_STATUS_COLORS[status]

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 text-sm active:cursor-grabbing"
    >
      <div className="font-semibold">{productName}</div>
      <div className="mt-1 text-xs text-gray-600">
        {lot.quantity} u · vence {lot.expiryDate}
      </div>
      <div className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${color}20`, color }}>
        {status}
      </div>
    </div>
  )
}

export function UnplacedLotsPanel({ lots, products }: { lots: Lot[]; products: Producto[] }) {
  const unplaced = lots.filter((lot) => !lot.locationId)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-sm font-semibold">Lotes sin ubicación</div>
      <div className="mt-3 space-y-2">
        {unplaced.map((lot) => {
          const product = products.find((p) => p.id === lot.productId)
          return (
            <DraggableLotCard
              key={lot.id}
              lot={lot}
              productName={product?.nombre ?? "Producto"}
            />
          )
        })}
        {unplaced.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-500">
            No hay lotes pendientes.
          </div>
        )}
      </div>
    </div>
  )
}

