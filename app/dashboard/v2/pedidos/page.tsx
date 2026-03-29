"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { PedidoForm } from "@/components/pedidos-v2/pedido-form"
import { usePedidosV2 } from "@/hooks/use-pedidos-v2"
import { useData } from "@/contexts/data-context"
import { useToast } from "@/hooks/use-toast"

export default function PedidosV2Page() {
  const { user } = useData()
  const { toast } = useToast()
  const pedidos = usePedidosV2()

  return (
    <DashboardLayout user={user}>
      <PedidoForm
        loading={pedidos.loading}
        onSubmit={async (payload) => {
          if (!user) return
          const result = await pedidos.createPedido({
            ...payload,
            estado: "pendiente",
            createdBy: user.uid,
            createdByName: user.displayName || user.email || "",
            createdByEmail: user.email || ""
          } as any)
          toast({ title: "Pedido creado", description: `Numero: ${result.numeroPedido}` })
        }}
      />
    </DashboardLayout>
  )
}
