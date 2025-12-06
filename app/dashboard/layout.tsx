"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider } from "@/contexts/data-context"
import { StockChatProvider } from "@/contexts/stock-chat-context"
import { StockChatFloating } from "@/components/stock/stock-chat-floating"
import { Loader2 } from "lucide-react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  // Ocultar el chat flotante en la página de stock (donde está integrado como sidebar)
  const isStockPage = pathname === "/dashboard/stock"

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      router.push("/")
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/")
      } else {
        setUser(currentUser)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

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

  return (
    <DataProvider user={user}>
      <StockChatProvider user={user}>
        {children}
        <StockChatFloating />
      </StockChatProvider>
    </DataProvider>
  )
}

