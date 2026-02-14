"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useParams, useSearchParams } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { Package, Loader2, Calendar, CalendarDays, Home } from "lucide-react"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider } from "@/contexts/data-context"
import { useOwnerIdFromSlug, useCompanySlugFromOwnerId } from "@/hooks/use-owner-data"
import { cn } from "@/lib/utils"

function setAuthCookie(token?: string) {
  if (typeof document === "undefined") return
  if (!token) {
    document.cookie = "firebase_id_token=; Path=/; Max-Age=0; SameSite=Lax"
    return
  }
  document.cookie = `firebase_id_token=${token}; Path=/; Max-Age=3600; SameSite=Lax; Secure`
}

/** Fallback para la barra de tabs mientras se resuelve useSearchParams (evita error en build estático) */
function PwaTabsFallback() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur h-14" />
  )
}

/** Tabs que usan useSearchParams; deben ir dentro de Suspense para pre-render */
function PwaTabs() {
  const pathname = usePathname()
  const params = useParams()
  const searchParams = useSearchParams()
  const companySlugFromParams = params?.companySlug as string | undefined
  const uidFromQuery = pathname === "/pwa/mensual" ? searchParams.get("uid") : null
  const { companySlug: companySlugFromUid } = useCompanySlugFromOwnerId(uidFromQuery)
  const effectiveSlug = companySlugFromParams ?? companySlugFromUid ?? null
  const { ownerId } = useOwnerIdFromSlug(effectiveSlug)
  const effectiveOwnerId = uidFromQuery ?? ownerId
  const mensualHref = effectiveOwnerId ? `/pwa/mensual?uid=${encodeURIComponent(effectiveOwnerId)}` : "/pwa/mensual"

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-lg items-center justify-around px-3 py-2">
        {effectiveSlug ? [
          { href: `/pwa/${effectiveSlug}/horario`, label: "Horario", icon: Calendar, pathMatch: null as string | null },
          { href: mensualHref, label: "Mensual", icon: CalendarDays, pathMatch: "/pwa/mensual" },
          { href: `/pwa/${effectiveSlug}/home`, label: "Panel", icon: Home, pathMatch: null as string | null },
          { href: `/pwa/stock-console/${effectiveSlug}`, label: "Stock", icon: Package, pathMatch: null as string | null }
        ].map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.pathMatch != null && pathname === item.pathMatch)
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
}

export function PwaShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <DataProvider user={user}>
      <div className="min-h-screen bg-background pb-20">
        {children}
        <Suspense fallback={<PwaTabsFallback />}>
          <PwaTabs />
        </Suspense>
      </div>
    </DataProvider>
  )
}
