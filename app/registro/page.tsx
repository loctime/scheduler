"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { doc, setDoc, serverTimestamp, query, where, getDocs, updateDoc, collection, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { auth, db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

function RegistroContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [ownerId, setOwnerId] = useState<string | null>(null)

  // Validar token
  useEffect(() => {
    const validarToken = async () => {
      if (!token || !db) {
        setValidating(false)
        return
      }

      try {
        const q = query(
          collection(db, COLLECTIONS.INVITACIONES),
          where("token", "==", token),
          where("activo", "==", true),
          where("usado", "==", false)
        )
        const snapshot = await getDocs(q)
        
        if (snapshot.empty) {
          setTokenValid(false)
          toast({
            title: "Link inválido",
            description: "Este link de invitación no es válido o ya fue usado",
            variant: "destructive",
          })
        } else {
          setTokenValid(true)
          const linkData = snapshot.docs[0].data()
          setOwnerId(linkData.ownerId)
        }
      } catch (error) {
        console.error("Error validating token:", error)
        setTokenValid(false)
      } finally {
        setValidating(false)
      }
    }

    validarToken()
  }, [token, toast])

  const handleGoogleSignIn = async () => {
    if (!token || !tokenValid || !ownerId) {
      toast({
        title: "Error",
        description: "Token de invitación inválido",
        variant: "destructive",
      })
      return
    }

    if (!auth || !db) {
      toast({
        title: "Error de configuración",
        description: "Firebase no está configurado correctamente",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      // Buscar el link de invitación nuevamente para asegurarnos de que sigue válido
      // IMPORTANTE: Verificar ANTES de autenticar para evitar que alguien use un link ya usado
      const q = query(
        collection(db, COLLECTIONS.INVITACIONES),
        where("token", "==", token),
        where("activo", "==", true),
        where("usado", "==", false)
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        toast({
          title: "Link ya usado",
          description: "Este link de invitación ya fue usado por otro usuario. Solicita un nuevo link.",
          variant: "destructive",
        })
        return
      }

      const linkDoc = snapshot.docs[0]

      // Autenticar con Google
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      console.log("✅ Usuario autenticado con Google:", user.uid, user.email)

      // Verificar si el usuario ya existe en Firestore
      const userRef = doc(db, COLLECTIONS.USERS, user.uid)
      console.log("🔍 Verificando si usuario existe en Firestore...")
      const userDoc = await getDoc(userRef)
      console.log("📄 Usuario existe?", userDoc.exists())

      if (userDoc.exists()) {
        const userData = userDoc.data()
        // Si el usuario ya existe pero no es invitado, o es invitado de otro owner, mostrar error
        if (userData.role !== "invited" || (userData.ownerId && userData.ownerId !== ownerId)) {
          toast({
            title: "Cuenta existente",
            description: "Esta cuenta ya está registrada. Por favor inicia sesión normalmente.",
            variant: "destructive",
          })
          // Cerrar sesión para que pueda iniciar sesión normalmente
          await signOut(auth)
          return
        }
        // Si ya es invitado del mismo owner, actualizar información usando updateDoc
        console.log("🔄 Actualizando usuario existente...")
        await updateDoc(userRef, {
          email: user.email,
          displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
          photoURL: user.photoURL || null,
          updatedAt: serverTimestamp(),
        })
        console.log("✅ Usuario actualizado exitosamente")

        // Marcar link como usado si no estaba ya usado
        const linkData = linkDoc.data()
        if (!linkData.usado) {
          console.log("🔗 Marcando invitación como usada (usuario existente), linkDoc.id:", linkDoc.id)
          await updateDoc(doc(db, COLLECTIONS.INVITACIONES, linkDoc.id), {
            usado: true,
            usadoPor: user.uid,
            usadoEn: serverTimestamp(),
          })
          console.log("✅ Invitación marcada como usada")
        }
      } else {
        // Crear nuevo documento de usuario con role 'invited' y ownerId
        console.log("➕ Creando nuevo usuario con role 'invited' y ownerId:", ownerId)
        console.log("📝 Datos del usuario:", {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: "invited",
          ownerId: ownerId
        })
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
          photoURL: user.photoURL || null,
          role: "invited",
          ownerId: ownerId, // ID del usuario principal
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        console.log("✅ Usuario creado exitosamente")

        // Marcar link como usado solo si es un nuevo usuario
        console.log("🔗 Marcando invitación como usada, linkDoc.id:", linkDoc.id)
        await updateDoc(doc(db, COLLECTIONS.INVITACIONES, linkDoc.id), {
          usado: true,
          usadoPor: user.uid,
          usadoEn: serverTimestamp(),
        })
        console.log("✅ Invitación marcada como usada")
      }

      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido vinculada exitosamente. Redirigiendo...",
      })

      // Redirigir al dashboard
      setTimeout(() => {
        router.push("/dashboard/pedidos")
      }, 1000)
    } catch (error: any) {
      console.error("❌ Error en registro:", error)
      console.error("❌ Código de error:", error.code)
      console.error("❌ Mensaje de error:", error.message)
      console.error("❌ Stack:", error.stack)
      if (error.code === "auth/popup-closed-by-user") {
        toast({
          title: "Registro cancelado",
          description: "El registro fue cancelado. Por favor intenta nuevamente.",
          variant: "destructive",
        })
      } else if (error.code === "auth/account-exists-with-different-credential") {
        toast({
          title: "Cuenta existente",
          description: "Ya existe una cuenta con este email usando otro método de autenticación.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "No se pudo completar el registro",
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!token || !tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              Este link de invitación no es válido o ya fue usado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Registro de Colaborador</CardTitle>
          <CardDescription>
            Inicia sesión con Google para acceder a la gestión de pedidos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full"
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar con Google
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Al continuar, aceptas vincular tu cuenta de Google con esta invitación
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <RegistroContent />
    </Suspense>
  )
}

