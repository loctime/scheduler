"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DevolucionRemitoForm } from "@/components/logistics-v2/devolucion-remito-form"
import { useData } from "@/contexts/data-context"
import { useLogisticsV2 } from "@/hooks/use-logistics-v2"
import { useToast } from "@/hooks/use-toast"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export default function NuevaDevolucionPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = getOwnerIdForActor(user, userData) || ""
  const branchId = userData?.uid || user?.uid || ownerId
  const logistics = useLogisticsV2()

  return (
    <DashboardLayout user={user}>
      <DevolucionRemitoForm
        defaultOwnerId={ownerId}
        defaultBranchId={branchId}
        loading={logistics.loading}
        onSubmit={async (payload) => {
          const devolucion = await logistics.crearDevolucionRemito(payload)
          toast({ title: "Devolucion creada", description: `ID: ${devolucion.id}` })
        }}
      />
    </DashboardLayout>
  )
}
