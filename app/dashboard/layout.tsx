"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider, useData } from "@/contexts/data-context"
import { StockProvider } from "@/contexts/stock-context"
import { Loader2 } from "lucide-react"
import { canUser } from "@/lib/permissions"

// P??ginas p??blicas (no requieren autenticaci??n)
// Solo la vista con companySlug es p??blica; la ruta base requiere auth
const isPublicMensualPage = (path: string) => path.match(/^\/dashboard\/horarios-mensuales\/[^/]+$/)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const isPublicPage = isPublicMensualPage(pathname)

    if (isPublicPage) {
      setLoading(false)
      return
    }

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
  }, [router, pathname])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isPublicPage = isPublicMensualPage(pathname)
  if (isPublicPage) {
    return <>{children}</>
  }

  if (!user) {
    return null
  }

  return (
    <DataProvider user={user}>
      <StockProvider user={user}>
        <ProtectedRoute user={user} pathname={pathname} router={router}>
          {children}
        </ProtectedRoute>
      </StockProvider>
    </DataProvider>
  )
}

function ProtectedRoute({
  children,
  user,
  pathname,
  router,
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
      const allowed = canUser(
        { uid: user?.uid, role: userData.role, locationId: userData.locationId },
        "ver_dashboard"
      )

      if (!allowed) {
        router.push(userData.role === "colaborador" ? "/pwa" : "/")
        return
      }
      setChecking(false)
    }
  }, [userData, pathname, router, user])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}

