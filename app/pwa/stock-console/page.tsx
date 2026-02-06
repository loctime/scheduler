"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { StockConsoleContent } from "@/components/stock-console-content"
import { useData } from "@/contexts/data-context"
import { Loader2 } from "lucide-react"

export default function PwaStockConsolePage() {
  const router = useRouter()
  const { user, loading } = useData()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/pwa")
    }
  }, [loading, router, user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <StockConsoleContent />
}
