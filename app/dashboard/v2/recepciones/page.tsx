"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { RecepcionForm } from "@/components/pedidos-v2/recepcion-form"
import { usePedidosV2 } from "@/hooks/use-pedidos-v2"
import { useData } from "@/contexts/data-context"
import { useToast } from "@/hooks/use-toast"

export default function RecepcionesV2Page() {
  const { user } = useData()
  const { toast } = useToast()
  const pedidos = usePedidosV2()

  return (
    <DashboardLayout user={user}>
      <RecepcionForm
        loading={pedidos.loading}
        onSubmit={async (payload) => {
          if (!user) return
          const result = await pedidos.confirmarRecepcion({
            ...payload,
            estado: "confirmada",
            createdBy: user.uid,
            createdByName: user.displayName || user.email || "",
            createdByEmail: user.email || ""
          } as any)
          toast({ title: "Recepcion confirmada", description: `Numero: ${result.numero}` })
        }}
      />
    </DashboardLayout>
  )
}
