"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useParams } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { Package, Loader2, Calendar, CalendarDays, Home } from "lucide-react"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider } from "@/contexts/data-context"
import { cn } from "@/lib/utils"

function setAuthCookie(token?: string) {
  if (typeof document === "undefined") return
  if (!token) {
    document.cookie = "firebase_id_token=; Path=/; Max-Age=0; SameSite=Lax"
    return
  }
  document.cookie = `firebase_id_token=${token}; Path=/; Max-Age=3600; SameSite=Lax; Secure`
}

export function PwaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Slug solo desde la URL (multi-tenant público); no depende de autenticación
  const companySlug = params?.companySlug as string

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const token = await currentUser.getIdToken()
        setAuthCookie(token)
      } else {
        setAuthCookie()
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const existingManifest = document.querySelector('link[rel="manifest"][href="/manifest-pwa.json"]')
    if (!existingManifest) {
      const link = document.createElement("link")
      link.rel = "manifest"
      link.href = "/manifest-pwa.json"
      document.head.appendChild(link)
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw-pwa.js", { scope: "/pwa/" }).catch(() => {})
    }
  }, [])

  // Tabs de navegación: slug siempre desde la URL
  const renderTabs = () => (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-center justify-around px-3 py-2">
        {companySlug ? [
          { href: `/pwa/${companySlug}/horario`, label: "Horario", icon: Calendar },
          { href: `/pwa/${companySlug}/mensual`, label: "Mensual", icon: CalendarDays },
          { href: `/pwa/${companySlug}/home`, label: "Panel", icon: Home },
          { href: `/pwa/stock-console/${companySlug}`, label: "Stock", icon: Package }
        ].map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-md py-2 text-xs font-medium transition",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          )
        }) : null}
      </div>
    </nav>
  )

  // Estado de carga (solo mientras se resuelve auth; no bloquear por falta de usuario)
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Renderizado principal
  return (
    <DataProvider user={user}>
      <div className="min-h-screen bg-background pb-20">
        {children}
        {renderTabs()}
      </div>
    </DataProvider>
  )
}
