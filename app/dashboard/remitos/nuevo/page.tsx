"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { RemitoSalidaForm } from "@/components/logistics-v2/remito-salida-form"
import { useData } from "@/contexts/data-context"
import { useLogisticsV2 } from "@/hooks/use-logistics-v2"
import { useToast } from "@/hooks/use-toast"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export default function NuevoRemitoPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = getOwnerIdForActor(user, userData) || ""
  const branchId = userData?.uid || user?.uid || ownerId
  const logistics = useLogisticsV2()

  return (
    <DashboardLayout user={user}>
      <RemitoSalidaForm
        defaultOwnerId={ownerId}
        defaultBranchId={branchId}
        loading={logistics.loading}
        onSubmit={async (payload) => {
          const remito = await logistics.emitirRemitoSalida(payload)
          toast({ title: "Remito emitido", description: `Numero: ${remito.numeroRemito}` })
        }}
      />
    </DashboardLayout>
  )
}
