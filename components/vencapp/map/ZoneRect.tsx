"use client"

import { Rnd } from "react-rnd"
import { useDroppable } from "@dnd-kit/core"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"
import { VENCAPP_STATUS_COLORS } from "@/lib/vencapp-constants"
import { getLotDaysRemaining, getLotStatus } from "@/lib/vencapp-status"

interface ZoneRectProps {
  zone: WarehouseZone
  lots: Lot[]
  products: Producto[]
  status: "danger" | "warn" | "ok" | "empty"
  editMode: boolean
  hasChildren: boolean
  onSelect: () => void
  onEnter: () => void
  onUpdate: (data: Partial<WarehouseZone>) => void
}

export function ZoneRect({
  zone,
  lots,
  products,
  status,
  editMode,
  hasChildren,
  onSelect,
  onEnter,
  onUpdate,
}: ZoneRectProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: zone.id,
    data: { zoneId: zone.id },
  })
  const background = status === "empty" ? "#F7F7F7" : `${VENCAPP_STATUS_COLORS[status]}20`

  const canEnter = zone.type !== "estante"

  return (
    <Rnd
      size={{ width: zone.width, height: zone.height }}
      position={{ x: zone.x, y: zone.y }}
      onDragStop={(_, data) => {
        if (!editMode) return
        onUpdate({ x: data.x, y: data.y })
      }}
      onResizeStop={(_, __, ref, ___, position) => {
        if (!editMode) return
        onUpdate({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        })
      }}
      enableResizing={editMode}
      disableDragging={!editMode}
      bounds="parent"
    >
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        className="flex h-full w-full cursor-pointer flex-col justify-between rounded-lg border border-gray-200 p-2 text-xs"
        style={{
          background,
          borderColor: VENCAPP_STATUS_COLORS[status],
          outline: isOver ? `2px dashed ${VENCAPP_STATUS_COLORS[status]}` : "none",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">{zone.name}</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px]">
            {new Set(lots.map((lot) => lot.productId)).size}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {lots.slice(0, 3).map((lot) => {
            const product = products.find((p) => p.id === lot.productId)
            const initials = product?.nombre?.split(" ").map((p) => p[0]).join("").slice(0, 2) ?? "?"
            const statusLot = getLotStatus(lot.expiryDate)
            const days = getLotDaysRemaining(lot.expiryDate)
            return (
              <span
                key={lot.id}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `${VENCAPP_STATUS_COLORS[statusLot]}20`,
                  color: VENCAPP_STATUS_COLORS[statusLot],
                }}
              >
                {initials} · {days}d
              </span>
            )
          })}
          {lots.length > 3 && (
            <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[10px] text-gray-600">
              +{lots.length - 3}
            </span>
          )}
        </div>
        {canEnter && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEnter()
            }}
            className="self-start text-[11px] font-semibold text-gray-700"
          >
            Entrar →
          </button>
        )}
      </div>
    </Rnd>
  )
}
