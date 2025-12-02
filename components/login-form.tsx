"use client"

import { useState } from "react"
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { auth, db, COLLECTIONS } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Loader2, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [activeTab, setActiveTab] = useState("login")
  const { toast } = useToast()

  const createOrUpdateUserDoc = async (user: any) => {
    if (!db) return

    const userRef = doc(db, COLLECTIONS.USERS, user.uid)
    const userDoc = await getDoc(userRef)

    if (!userDoc.exists()) {
      // Si el usuario no existe en nuestra colección, crear el documento con role 'user' por defecto
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Usuario",
        photoURL: user.photoURL || null,
        role: 'user', // Role por defecto para nuevos usuarios
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      // Si ya existe, actualizar la información
      // Si no tiene role, asignar 'user' por defecto
      const userData = userDoc.data()
      const updateData: any = {
        email: user.email,
        displayName: user.displayName || userData?.displayName || user.email?.split("@")[0] || "Usuario",
        photoURL: user.photoURL || userData?.photoURL || null,
        updatedAt: serverTimestamp(),
      }
      
      // Si no tiene role, asignar 'user' por defecto
      if (!userData?.role) {
        updateData.role = 'user'
      }
      
      await setDoc(userRef, updateData, { merge: true })
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
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

      // Crear el documento del usuario en Firestore
      await createOrUpdateUserDoc(user)

      toast({
        title: "Cuenta creada",
        description: "Tu cuenta ha sido creada exitosamente",
      })
    } catch (error: any) {
      // Si el email ya está en uso, intentar iniciar sesión
      if (error.code === "auth/email-already-in-use") {
        try {
          // Intentar iniciar sesión con las credenciales proporcionadas
          const signInResult = await signInWithEmailAndPassword(auth, email, password)
          const user = signInResult.user

          // Crear o actualizar el documento del usuario en Firestore para esta app
          await createOrUpdateUserDoc(user)

          toast({
            title: "Registro completado",
            description: "Tu cuenta ha sido vinculada a esta aplicación",
          })
        } catch (signInError: any) {
          // Si el inicio de sesión falla, mostrar el error correspondiente
          let errorMessage = "Este email ya está registrado en otra aplicación"
          
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
        // Otros errores de creación de cuenta
        let errorMessage = "Ocurrió un error inesperado"
        
        if (error.code === "auth/invalid-email") {
          errorMessage = "El email no es válido"
        } else if (error.code === "auth/weak-password") {
          errorMessage = "La contraseña es muy débil"
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
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

    try {
      setLoading(true)
      const result = await signInWithEmailAndPassword(auth, email, password)
      const user = result.user

      // Actualizar el documento del usuario en Firestore
      await createOrUpdateUserDoc(user)
    } catch (error: any) {
      let errorMessage = "Ocurrió un error inesperado"
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No existe una cuenta con este email"
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Contraseña incorrecta"
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El email no es válido"
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Email o contraseña incorrectos"
      }
      
      toast({
        title: "Error al iniciar sesión",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
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
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      // Crear o actualizar el documento del usuario
      await createOrUpdateUserDoc(user)
    } catch (error: any) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-border bg-card">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-accent">
          <Calendar className="h-8 w-8 text-accent-foreground" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl font-bold text-card-foreground">Gestión de Horarios</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Administra los horarios de tu equipo de forma eficiente
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
            <TabsTrigger value="signup">Registrarse</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="space-y-4 mt-4">
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tu contraseña"
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
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar sesión"
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4 mt-4">
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
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
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Crear cuenta"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">O continúa con</span>
          </div>
        </div>

        <Button
          onClick={handleGoogleSignIn}
          disabled={loading}
          variant="outline"
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            <>
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
              Iniciar sesión con Google
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
