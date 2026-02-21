"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged, getRedirectResult } from "firebase/auth"
import { auth, isFirebaseConfigured, db, COLLECTIONS } from "@/lib/firebase"
import { LoginForm } from "@/components/login-form"
import { FirebaseConfigNotice } from "@/components/firebase-config-notice"
import { Loader2 } from "lucide-react"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"

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

    // Manejar el resultado de la redirección de Google Sign-In
    const handleRedirectResult = async () => {
      if (!auth) return
      try {
        const result = await getRedirectResult(auth)
        if (result && result.user && db) {
          // Crear o actualizar el documento del usuario
          const userRef = doc(db, COLLECTIONS.USERS, result.user.uid)
          const userDoc = await getDoc(userRef)

          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName || result.user.email?.split("@")[0] || "Usuario",
              photoURL: result.user.photoURL || null,
              role: 'branch',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          } else {
            const userData = userDoc.data()
            const updateData: any = {
              email: result.user.email,
              displayName: result.user.displayName || userData?.displayName || result.user.email?.split("@")[0] || "Usuario",
              photoURL: result.user.photoURL || userData?.photoURL || null,
              updatedAt: serverTimestamp(),
            }
            
            if (!userData?.role) {
              updateData.role = 'branch'
            }
            
            await setDoc(userRef, updateData, { merge: true })
          }
        }
      } catch (error) {
        console.error("Error al procesar resultado de redirección:", error)
      }
    }

    handleRedirectResult()

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
