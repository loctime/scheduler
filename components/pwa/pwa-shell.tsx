"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { Calendar, CalendarDays, Package, Loader2 } from "lucide-react"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { DataProvider } from "@/contexts/data-context"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/pwa/horario", label: "Horario", icon: Calendar },
  { href: "/pwa/mensual", label: "Mensual", icon: CalendarDays },
  { href: "/pwa/stock-console", label: "Stock", icon: Package },
]

export function PwaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
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
      navigator.serviceWorker
        .register("/sw-pwa.js", { scope: "/pwa/" })
        .then((registration) => {
          console.log("PWA SW registrado:", registration)
        })
        .catch((error) => {
          console.error("PWA SW error:", error)
        })
    }
  }, [])

  return (
    <DataProvider user={user}>
      <div className="min-h-screen bg-background pb-20">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          children
        )}
        <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-lg items-center justify-around px-3 py-2">
            {navItems.map((item) => {
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
              )}
            )}
          </div>
        </nav>
      </div>
    </DataProvider>
  )
}
