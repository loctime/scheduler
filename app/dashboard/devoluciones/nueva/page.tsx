"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DevolucionRemitoForm } from "@/components/logistics-v2/devolucion-remito-form"
import { useData } from "@/contexts/data-context"
import { useLogisticsV2 } from "@/hooks/use-logistics-v2"
import { useToast } from "@/hooks/use-toast"
import { canUser } from "@/lib/permissions"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"

export default function NuevaDevolucionPage() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const ownerId = getOwnerIdForActor(user, userData) || ""
  const branchId = userData?.uid || user?.uid || ownerId
  const logistics = useLogisticsV2()
  const puedeRecibir = canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "recibir_pedido")

  if (!puedeRecibir) {
    return (
      <DashboardLayout user={user}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-700">Acceso denegado</h2>
            <p className="mt-2 text-sm text-red-600">No tienes permisos para registrar devoluciones.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

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
