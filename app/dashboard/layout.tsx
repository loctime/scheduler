"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider, useData } from "@/contexts/data-context"
import { StockChatProvider } from "@/contexts/stock-chat-context"
import { StockChatFloating } from "@/components/stock/stock-chat-floating"
import { Loader2 } from "lucide-react"

// Páginas permitidas para usuarios invitados
const ALLOWED_PAGES_FOR_INVITED = ["/dashboard/pedidos"]

// Páginas que requieren rol específico
const FACTORY_PAGES = ["/dashboard/fabrica", "/dashboard/fabrica/historial"]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

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
        <ProtectedRoute user={user} pathname={pathname} router={router}>
          {children}
        </ProtectedRoute>
        <StockChatFloating />
      </StockChatProvider>
    </DataProvider>
  )
}

// Componente para proteger rutas según el role del usuario
function ProtectedRoute({ 
  children, 
  user, 
  pathname, 
  router 
}: { 
  children: React.ReactNode
  user: any
  pathname: string
  router: any
}) {
  const { userData } = useData()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (userData) {
      // Si el usuario es invitado y está intentando acceder a una página no permitida
      if (userData.role === "invited" && !ALLOWED_PAGES_FOR_INVITED.includes(pathname)) {
        router.push("/dashboard/pedidos")
      }
      // Si el usuario intenta acceder a páginas de fábrica sin ser factory
      if (FACTORY_PAGES.some(page => pathname.startsWith(page)) && userData.role !== "factory") {
        router.push("/dashboard/pedidos")
      }
      setChecking(false)
    }
  }, [userData, pathname, router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}

