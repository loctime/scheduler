"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { LoginForm } from "@/components/login-form"
import { FirebaseConfigNotice } from "@/components/firebase-config-notice"
import { Loader2 } from "lucide-react"
import { usePwaInstall } from "@/hooks/usePwaInstall"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Download, X, Share2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

function sanitizeRedirectPath(path: string | null): string | null {
  if (!path) return null
  if (!path.startsWith("/")) return null
  if (path.startsWith("//")) return null
  return path
}

const SESSION_KEY_CUENTA_DESACTIVADA = "horarios_cuenta_desactivada"

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const { canInstall, isStandalone, isIOS, install, dismiss } = usePwaInstall()
  const { toast } = useToast()

  const redirectTarget = useMemo(() => {
    return sanitizeRedirectPath(searchParams.get("redirect"))
  }, [searchParams])

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace(redirectTarget || "/dashboard")
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router, redirectTarget])

  useEffect(() => {
    if (loading) return
    try {
      const msg = sessionStorage.getItem(SESSION_KEY_CUENTA_DESACTIVADA)
      if (msg) {
        sessionStorage.removeItem(SESSION_KEY_CUENTA_DESACTIVADA)
        toast({ title: msg, variant: "destructive" })
      }
    } catch {
      /* ignore */
    }
  }, [loading, toast])

  if (!isFirebaseConfigured()) {
    return <FirebaseConfigNotice />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        <LoginForm />

        {canInstall && !isIOS && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Instalar como app</p>
                  <p className="text-xs text-muted-foreground">
                    Accede rapido desde tu pantalla de inicio
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={install}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Instalar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={dismiss}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isIOS && !isStandalone && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Share2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Para instalar esta app
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Toca el boton <span className="font-medium">Compartir</span> y elige <span className="font-medium">Agregar a pantalla de inicio</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 dark:text-blue-400"
                  onClick={dismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
