"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { RemitoSalidaForm } from "@/components/pedidos-v2/remito-salida-form"
import { TransporteForm } from "@/components/pedidos-v2/transporte-form"
import { usePedidosV2 } from "@/hooks/use-pedidos-v2"
import { useData } from "@/contexts/data-context"
import { useToast } from "@/hooks/use-toast"

export default function RemitosSalidaV2Page() {
  const { user } = useData()
  const { toast } = useToast()
  const pedidos = usePedidosV2()

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <RemitoSalidaForm
          loading={pedidos.loading}
          onSubmit={async (payload) => {
            if (!user) return
            const result = await pedidos.emitirRemitoSalida({
              ...payload,
              estado: "emitido",
              firmaTransportista: {
                firmado: false,
                firmadoAt: new Date(),
                firmadoBy: "",
                firmadoByName: "",
                firmadoByEmail: "",
                firmaData: ""
              },
              createdBy: user.uid,
              createdByName: user.displayName || user.email || "",
              createdByEmail: user.email || ""
            } as any)
            toast({ title: "Remito emitido", description: `Numero: ${result.numero}` })
          }}
        />

        <TransporteForm
          loading={pedidos.loading}
          onSubmit={async (payload) => {
            await pedidos.registrarTransporte(payload)
            toast({ title: "Transporte registrado" })
          }}
        />
      </div>
    </DashboardLayout>
  )
}
