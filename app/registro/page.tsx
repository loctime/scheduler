"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signInWithRedirect, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, getRedirectResult } from "firebase/auth"
import { auth, db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { procesarRegistroInvitacion, validarTokenInvitacion } from "@/lib/invitacion-utils"

function RegistroContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const redirectTo = searchParams.get("redirect")
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Manejar el resultado de la redirección de Google Sign-In
  useEffect(() => {
    const handleRedirectResult = async () => {
      if (!auth || !db) return
      
      // Solo procesar si hay un token válido (para registro con invitación)
      if (!token || !tokenValid) {
        // Si no hay token, no es una página de registro con invitación, salir
        return
      }
      
      try {
        const result = await getRedirectResult(auth)
        if (result && result.user) {
          console.log("✅ Usuario autenticado con Google (redirect):", result.user.uid, result.user.email)
          
          // Procesar el registro con el token de invitación
          await procesarRegistroInvitacion(result.user, token)

          toast({
            title: "Registro exitoso",
            description: "Tu cuenta ha sido vinculada exitosamente. Redirigiendo...",
          })

          // Redirigir al dashboard
          setTimeout(() => {
            router.push(redirectTo || "/dashboard/pedidos")
          }, 1000)
        }
      } catch (error: any) {
        console.error("❌ Error al procesar resultado de redirección:", error)
        // Solo mostrar error si no es un error de "no hay resultado" (normal cuando no hay redirect pendiente)
        if (error.code !== 'auth/no-auth-event') {
          toast({
            title: "Error",
            description: error.message || "No se pudo completar el registro",
            variant: "destructive",
          })
        }
      }
    }

    // Esperar un poco para asegurar que auth esté listo
    const timer = setTimeout(() => {
      handleRedirectResult()
    }, 100)

    return () => clearTimeout(timer)
  }, [auth, token, tokenValid, redirectTo, router, toast, db])

  // Validar token
  useEffect(() => {
    const validarToken = async () => {
      try {
        const result = await validarTokenInvitacion(token)
        setTokenValid(result.tokenValid)
        setOwnerId(result.ownerId)
        if (!result.tokenValid) {
          toast({
            title: "Link inválido",
            description: "Este link de invitación no es válido o ya fue usado",
            variant: "destructive",
          })
        }
      } catch (error: any) {
        setTokenValid(false)
        toast({
          title: "Error al validar",
          description: "No se pudo validar el link de invitación. Intenta nuevamente.",
          variant: "destructive",
        })
      } finally {
        setValidating(false)
      }
    }

    validarToken()
  }, [token, toast])

  // Función compartida para procesar el registro después de la autenticación
  const procesarRegistro = async (user: any) => {
    if (!token || !tokenValid || !db) {
      throw new Error("Token de invitación inválido")
    }
    await procesarRegistroInvitacion(user, token)
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token || !tokenValid) {
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

    if (!email || !password) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const result = await createUserWithEmailAndPassword(auth, email, password)
      const user = result.user
      console.log("✅ Usuario autenticado con email:", user.uid, user.email)

      // Procesar el registro con el token de invitación
      await procesarRegistro(user)

      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido vinculada exitosamente. Redirigiendo...",
      })

      // Redirigir al dashboard
      setTimeout(() => {
        router.push(redirectTo || "/dashboard/pedidos")
      }, 1000)
    } catch (error: any) {
      console.error("❌ Error en registro:", error)
      
      // Si el email ya está en uso, intentar iniciar sesión
      if (error.code === "auth/email-already-in-use") {
        try {
          const signInResult = await signInWithEmailAndPassword(auth, email, password)
          const user = signInResult.user
          
          // Procesar el registro con el token de invitación
          await procesarRegistro(user)

          toast({
            title: "Registro exitoso",
            description: "Tu cuenta ha sido vinculada exitosamente. Redirigiendo...",
          })

          setTimeout(() => {
            router.push(redirectTo || "/dashboard/pedidos")
          }, 1000)
        } catch (signInError: any) {
          let errorMessage = "Este email ya está registrado"
          
          if (signInError.code === "auth/wrong-password") {
            errorMessage = "Este email ya está registrado. La contraseña proporcionada es incorrecta"
          } else if (signInError.code === "auth/invalid-credential") {
            errorMessage = "Este email ya está registrado. Las credenciales son incorrectas"
          }
          
          toast({
            title: "Error al registrar",
            description: errorMessage,
            variant: "destructive",
          })
        }
      } else {
        let errorMessage = "Ocurrió un error inesperado"
        
        if (error.code === "auth/invalid-email") {
          errorMessage = "El email no es válido"
        } else if (error.code === "auth/weak-password") {
          errorMessage = "La contraseña es muy débil"
        } else if (error.message) {
          errorMessage = error.message
        }
        
        toast({
          title: "Error al crear cuenta",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!token || !tokenValid) {
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
      const provider = new GoogleAuthProvider()
      
      // Configurar para mostrar selector de cuenta
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      
      // Usar redirect en lugar de popup para evitar problemas en producción
      await signInWithRedirect(auth, provider)
      // No necesitamos manejar el resultado aquí, se manejará en el useEffect con getRedirectResult
    } catch (error: any) {
      setLoading(false)
      console.error("❌ Error en registro:", error)
      
      if (error.code === "auth/unauthorized-domain") {
        toast({
          title: "Dominio no autorizado",
          description: `El dominio ${typeof window !== 'undefined' ? window.location.hostname : ''} no está autorizado. Agrégalo en Firebase Console → Authentication → Settings → Authorized domains`,
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
            Completa tu registro usando email y contraseña o con Google
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  La contraseña debe tener al menos 6 caracteres
                </p>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Registrarse con Email"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">O continúa con</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full"
              disabled={loading}
              variant="outline"
              size="lg"
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
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Al continuar, aceptas vincular tu cuenta con esta invitación
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
