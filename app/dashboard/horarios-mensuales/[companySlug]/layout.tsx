"use client"

import { ReactNode } from "react"

export default function PublicDashboardLayout({ children }: { children: ReactNode }) {
  // Layout simple para páginas públicas del dashboard
  // Sin DataProvider, sin StockChatProvider, sin autenticación
  return <>{children}</>
}
