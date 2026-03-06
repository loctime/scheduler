"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { RecepcionRemitoForm } from "@/components/logistics-v2/recepcion-remito-form"
import { useData } from "@/contexts/data-context"
import { useLogisticsV2 } from "@/hooks/use-logistics-v2"
import { useToast } from "@/hooks/use-toast"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export default function NuevaRecepcionPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = getOwnerIdForActor(user, userData) || ""
  const branchId = userData?.uid || user?.uid || ownerId
  const logistics = useLogisticsV2()

  return (
    <DashboardLayout user={user}>
      <RecepcionRemitoForm
        defaultOwnerId={ownerId}
        defaultBranchId={branchId}
        loading={logistics.loading}
        onSubmit={async (payload) => {
          const recepcion = await logistics.confirmarRecepcionRemito(payload)
          toast({ title: "Recepcion confirmada", description: `ID: ${recepcion.id}` })
        }}
      />
    </DashboardLayout>
  )
}
