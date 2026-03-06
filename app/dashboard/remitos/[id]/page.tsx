"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import { useLogisticsV2 } from "@/hooks/use-logistics-v2"
import type { RemitoSalida } from "@/types/logistics-v2"

export default function RemitoDetallePage() {
  const params = useParams()
  const { user } = useData()
  const logistics = useLogisticsV2()
  const [remito, setRemito] = useState<RemitoSalida | null>(null)

  useEffect(() => {
    const id = String(params.id || "")
    if (!id) return

    logistics
      .getRemitoById(id)
      .then(setRemito)
      .catch(() => setRemito(null))
  }, [params.id])

  return (
    <DashboardLayout user={user}>
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <h1 className="text-xl font-semibold">Detalle Remito V2</h1>
        {!remito ? (
          <p className="text-sm text-muted-foreground">Sin datos de remito.</p>
        ) : (
          <>
            <p><strong>Numero:</strong> {remito.numeroRemito}</p>
            <p><strong>Estado:</strong> {remito.estado}</p>
            <p><strong>Origen:</strong> {remito.origen}</p>
            <p><strong>Destino:</strong> {remito.destino}</p>
            <p><strong>Transportista:</strong> {remito.transportista}</p>
            <p><strong>Items:</strong> {remito.itemsSnapshot.length}</p>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
