"use client"

import { useParams } from "next/navigation"
import { PwaShell } from "@/components/pwa/pwa-shell"
import { StockConsoleContent } from "@/components/stock-console-content"

export default function PwaStockConsolePage() {
  const params = useParams()
  const companySlug = params.companySlug as string

  return (
    <PwaShell>
      <StockConsoleContent companySlug={companySlug} />
    </PwaShell>
  )
}
