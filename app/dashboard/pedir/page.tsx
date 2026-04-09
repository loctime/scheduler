"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"
import PedirInsumosContent from "@/components/pedir/pedir-insumos-content"

export default function PedirLogisticaPage() {
  const { user, userData } = useData()
  return (
    <DashboardLayout user={user}>
      <PedirInsumosContent user={user} userData={userData} />
    </DashboardLayout>
  )
}
