"use client"

import { useEffect } from "react"
import { useData } from "@/contexts/data-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { StockConsoleContent } from "@/components/stock-console-content"

export default function StockConsolePage() {
  const { user } = useData()

  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      console.log("Usuario no autenticado, DashboardLayout redirigirá al login")
    }
  }, [user])

  return (
    <DashboardLayout user={user}>
      <StockConsoleContent showPwaMeta registerLegacyServiceWorker />
    </DashboardLayout>
  )
}
