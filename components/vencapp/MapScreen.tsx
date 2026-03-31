"use client"

import { useMemo, useState } from "react"
import { DndContext, DragEndEvent } from "@dnd-kit/core"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { VENCAPP_DEFAULT_ZONE_SIZE, VENCAPP_ZONE_TYPES } from "@/lib/vencapp-constants"
import { getZoneStatus } from "@/lib/vencapp-status"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"
import { WarehouseCanvas } from "@/components/vencapp/map/WarehouseCanvas"
import { ZoneRect } from "@/components/vencapp/map/ZoneRect"
import { ZoneSheet } from "@/components/vencapp/map/ZoneSheet"
import { UnplacedLotsPanel } from "@/components/vencapp/map/UnplacedLotsPanel"

interface MapScreenProps {
  productos: Producto[]
  lots: Lot[]
  zones: WarehouseZone[]
  loading: boolean
  addZone: (input: Omit<WarehouseZone, "id" | "ownerId" | "userId" | "createdAt" | "updatedAt">) => Promise<any>
  updateZone: (zoneId: string, data: Partial<WarehouseZone>) => Promise<any>
  removeZone: (zoneId: string) => Promise<any>
  updateLot: (lotId: string, data: Partial<Lot>) => Promise<any>
}

export function MapScreen({
  productos,
  lots,
  zones,
  addZone,
  updateZone,
  removeZone,
  updateLot,
}: MapScreenProps) {
  const { toast } = useToast()
  const [editMode, setEditMode] = useState(false)
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

  const zonesInScope = useMemo(
    () => zones.filter((zone) => (currentParentId ? zone.parentId === currentParentId : !zone.parentId)),
    [zones, currentParentId]
  )

  const zonesById = useMemo(() => {
    const map: Record<string, WarehouseZone> = {}
    zones.forEach((zone) => {
      map[zone.id] = zone
    })
    return map
  }, [zones])

  const handleAddZone = async (type: WarehouseZone["type"]) => {
    const parent = currentParentId ? zonesById[currentParentId] : null
    const parentHasLots = parent ? lots.some((lot) => lot.locationId === parent.id) : false
    if (parentHasLots) {
      toast({
        title: "Zona con lotes",
        description: "No podés crear subzonas si esta zona ya tiene lotes.",
      })
      return
    }

    const offset = zonesInScope.length * 20
    await addZone({
      name: `${type.charAt(0).toUpperCase()}${type.slice(1)} ${zonesInScope.length + 1}`,
      type,
      x: 20 + offset,
      y: 20 + offset,
      width: VENCAPP_DEFAULT_ZONE_SIZE.width,
      height: VENCAPP_DEFAULT_ZONE_SIZE.height,
      parentId: currentParentId,
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event
    if (!over) return
    const lotId = active.data.current?.lotId as string | undefined
    const zoneId = over.data.current?.zoneId as string | undefined
    if (!lotId || !zoneId) return

    const hasChildren = zones.some((zone) => zone.parentId === zoneId)
    if (hasChildren) {
      toast({
        title: "Zona con subzonas",
        description: "Los lotes deben ir en subzonas, no en el contenedor.",
      })
      return
    }

    await updateLot(lotId, { locationId: zoneId })
  }

  const selectedZone = selectedZoneId ? zonesById[selectedZoneId] : null
  const selectedZoneLots = selectedZoneId ? lots.filter((lot) => lot.locationId === selectedZoneId) : []

  const breadcrumb = useMemo(() => {
    if (!currentParentId) return "Depósito"
    const parent = zonesById[currentParentId]
    return parent ? `Depósito > ${parent.name}` : "Depósito"
  }, [currentParentId, zonesById])

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {currentParentId ? (
            <button
              type="button"
              onClick={() => setCurrentParentId(null)}
              className="text-sm text-gray-600"
            >
              ← Depósito
            </button>
          ) : null}
          <div className="text-sm text-gray-500">{breadcrumb}</div>
          <h2 className="text-lg font-semibold">Mapa</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Edit mode</span>
          <Switch checked={editMode} onCheckedChange={setEditMode} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {VENCAPP_ZONE_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            className="h-10 border-gray-200 text-sm"
            onClick={() => handleAddZone(type)}
          >
            + {type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
        <DndContext onDragEnd={handleDragEnd}>
          <WarehouseCanvas>
            {zonesInScope.map((zone) => {
              const zoneLots = lots.filter((lot) => lot.locationId === zone.id)
              const status = getZoneStatus(zone.id, zones, lots)
              return (
                <ZoneRect
                  key={zone.id}
                  zone={zone}
                  lots={zoneLots}
                  products={productos}
                  status={status}
                  editMode={editMode}
                  onSelect={() => setSelectedZoneId(zone.id)}
                  onEnter={() => setCurrentParentId(zone.id)}
                  onUpdate={(data) => updateZone(zone.id, data)}
                  hasChildren={zones.some((child) => child.parentId === zone.id)}
                />
              )
            })}
          </WarehouseCanvas>
          <UnplacedLotsPanel lots={lots} products={productos} />
        </DndContext>
      </div>

      <ZoneSheet
        zone={selectedZone}
        lots={selectedZoneLots}
        products={productos}
        onClose={() => setSelectedZoneId(null)}
        onEnter={() => {
          if (selectedZone) {
            setCurrentParentId(selectedZone.id)
            setSelectedZoneId(null)
          }
        }}
        onDelete={async () => {
          if (!selectedZone) return
          const hasLots = lots.some((lot) => lot.locationId === selectedZone.id)
          if (hasLots && !confirm("Esta zona tiene lotes. ¿Querés eliminarla igualmente?")) {
            return
          }
          await removeZone(selectedZone.id)
          setSelectedZoneId(null)
        }}
      />
    </div>
  )
}
