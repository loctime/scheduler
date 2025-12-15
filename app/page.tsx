"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged } from "firebase/auth"
import { auth, isFirebaseConfigured } from "@/lib/firebase"
import { LoginForm } from "@/components/login-form"
import { FirebaseConfigNotice } from "@/components/firebase-config-notice"
import { Loader2 } from "lucide-react"

// Función para detectar si está corriendo como PWA
function isPWA(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches
}

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Solo redirigir al chat si está corriendo como PWA
        if (isPWA()) {
          router.push("/chat")
        } else {
          // Si es web normal, redirigir al dashboard
          router.push("/dashboard")
        }
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

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
      <LoginForm />
    </div>
  )
}
