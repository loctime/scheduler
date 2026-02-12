"use client"

import { useParams } from "next/navigation"
import { useData } from "@/contexts/data-context"
import { LoginForm } from "@/components/login-form"
import { Card, CardContent } from "@/components/ui/card"
import { PwaShell } from "@/components/pwa/pwa-shell"
import { StockConsoleContent } from "@/components/stock-console-content"

export default function PwaStockConsolePage() {
  const params = useParams()
  const { user } = useData()
  const companySlug = params.companySlug as string

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <PwaShell>
      <StockConsoleContent companySlug={companySlug} />
    </PwaShell>
  )
}
