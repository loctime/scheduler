"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DocumentosLogisticaTable } from "@/components/logistics-v2/documentos-logistica-table"
import { useData } from "@/contexts/data-context"
import { useLogisticsV2 } from "@/hooks/use-logistics-v2"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { toDevolucionViewModel, toRecepcionViewModel, toRemitoViewModel } from "@/src/modules/logistics-v2/ui/view-models"
import type { DocumentoLogisticoListQuery } from "@/types/logistics-v2"

export default function DocumentosLogisticaPage() {
  const { user, userData } = useData()
  const logistics = useLogisticsV2()
  const [items, setItems] = useState<Array<any>>([])

  const ownerId = getOwnerIdForActor(user, userData) || ""
  const branchId = userData?.uid || user?.uid || ownerId

  useEffect(() => {
    if (!ownerId) return

    const query: DocumentoLogisticoListQuery = {
      ownerId,
      branchId,
      page: 1,
      pageSize: 50
    }

    logistics
      .listDocumentos(query)
      .then((response) => setItems(response.items))
      .catch(() => setItems([]))
  }, [ownerId, branchId])

  const viewModels = useMemo(
    () =>
      items.map((item) => {
        if ("numeroRemito" in item) return toRemitoViewModel(item)
        if ("numeroRemitoSnapshot" in item) return toRecepcionViewModel(item)
        return toDevolucionViewModel(item)
      }),
    [items]
  )

  return (
    <DashboardLayout user={user}>
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <h1 className="text-xl font-semibold">Documentos Logistica</h1>
        <DocumentosLogisticaTable items={viewModels} />
      </div>
    </DashboardLayout>
  )
}
