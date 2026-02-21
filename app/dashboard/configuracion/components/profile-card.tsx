"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { db, auth, COLLECTIONS } from "@/lib/firebase"
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from "firebase/auth"
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { Loader2, EyeOff, Eye, User, Mail, Lock, Key } from "lucide-react"

export function ProfileCard() {
  const { user, userData } = useData()
  const { toast } = useToast()

  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [linkPasswordDialogOpen, setLinkPasswordDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [linkPassword, setLinkPassword] = useState("")
  const [linkConfirmPassword, setLinkConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showLinkPassword, setShowLinkPassword] = useState(false)
  const [showLinkConfirmPassword, setShowLinkConfirmPassword] = useState(false)
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)
  
  // Detectar si el usuario tiene método de email/contraseña
  const hasEmailPassword = auth?.currentUser?.providerData?.some(
    (provider) => provider.providerId === "password"
  ) ?? false
  
  // Detectar si el usuario tiene Google Auth
  const hasGoogleAuth = auth?.currentUser?.providerData?.some(
    (provider) => provider.providerId === "google.com"
  ) ?? false
  

  const loadAvailableOwners = async () => {
    return
  }

  // Cargar email del referido (owner) para mostrar en el perfil
  useEffect(() => {
    let mounted = true
    const fetchOwnerEmail = async () => {
      if (!db || !userData?.ownerId) {
        if (mounted) setOwnerEmail(null)
        return
      }
      try {
        const ownerRef = doc(db, COLLECTIONS.USERS, userData.ownerId)
        const snap = await getDoc(ownerRef)
        if (!mounted) return
        if (snap.exists()) {
          // @ts-ignore
          setOwnerEmail(snap.data()?.email || null)
        } else {
          setOwnerEmail(null)
        }
      } catch (error) {
        if (mounted) setOwnerEmail(null)
      }
    }
    fetchOwnerEmail()
    return () => { mounted = false }
  }, [userData?.ownerId, db])


  const handleUpdateEmail = async () => {
    if (!auth?.currentUser || !user?.email) {
      toast({
        title: "Error",
        description: "No estás autenticado",
        variant: "destructive",
      })
      return
    }

    if (!newEmail || !newEmail.includes("@")) {
      toast({
        title: "Error",
        description: "Por favor ingresa un email válido",
        variant: "destructive",
      })
      return
    }

    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu contraseña actual para confirmar",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingProfile(true)
      const currentUser = auth.currentUser
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updateEmail(currentUser, newEmail)

      if (db) {
        const userRef = doc(db, COLLECTIONS.USERS, currentUser.uid)
        await updateDoc(userRef, {
          email: newEmail,
          updatedAt: serverTimestamp(),
        })
      }

      toast({
        title: "Email actualizado",
        description: "Tu email ha sido actualizado exitosamente",
      })

      setEmailDialogOpen(false)
      setNewEmail("")
      setCurrentPassword("")
    } catch (error: any) {
      let errorMessage = "No se pudo actualizar el email"

      if (error.code === "auth/wrong-password") {
        errorMessage = "La contraseña actual es incorrecta"
      } else if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este email ya está en uso"
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El email no es válido"
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Por favor, vuelve a iniciar sesión para cambiar tu email"
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!auth?.currentUser || !user?.email) {
      toast({
        title: "Error",
        description: "No estás autenticado",
        variant: "destructive",
      })
      return
    }

    if (!currentPassword) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu contraseña actual",
        variant: "destructive",
      })
      return
    }

    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "La nueva contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingProfile(true)
      const currentUser = auth.currentUser
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)

      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido actualizada exitosamente",
      })

      setPasswordDialogOpen(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      let errorMessage = "No se pudo actualizar la contraseña"

      if (error.code === "auth/wrong-password") {
        errorMessage = "La contraseña actual es incorrecta"
      } else if (error.code === "auth/weak-password") {
        errorMessage = "La nueva contraseña es muy débil"
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Por favor, vuelve a iniciar sesión para cambiar tu contraseña"
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleLinkPassword = async () => {
    if (!auth?.currentUser || !user?.email) {
      toast({
        title: "Error",
        description: "No estás autenticado",
        variant: "destructive",
      })
      return
    }

    if (!linkPassword || linkPassword.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    if (linkPassword !== linkConfirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingProfile(true)
      const currentUser = auth.currentUser
      
      if (!currentUser) {
        throw new Error("Usuario no autenticado")
      }

      // Intentar usar updatePassword directamente
      // Firebase permite establecer una contraseña en una cuenta de Google Auth
      // si el usuario está autenticado recientemente
      await updatePassword(currentUser, linkPassword)

      toast({
        title: "Contraseña establecida",
        description: "Ahora puedes iniciar sesión con email y contraseña",
      })

      setLinkPasswordDialogOpen(false)
      setLinkPassword("")
      setLinkConfirmPassword("")
      
      // Recargar la página para actualizar el estado del usuario
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      let errorMessage = "No se pudo establecer la contraseña"

      if (error.code === "auth/weak-password") {
        errorMessage = "La contraseña es muy débil. Debe tener al menos 6 caracteres"
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Por favor, vuelve a iniciar sesión con Google para establecer la contraseña"
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage = "Esta operación no está permitida. Contacta al administrador"
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleUpdateOwner = async () => {
    return
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Perfil de Usuario
        </CardTitle>
        <CardDescription>Gestiona tu información personal y credenciales</CardDescription>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rol:</span>
          <Badge variant="outline" className="uppercase">
            {(() => {
              const role = userData?.role || "user"
              switch (role) {
                case "admin":
                  return "Administrador"
                case "manager":
                  return "Gerente"
                case "factory":
                  return "Fábrica"
                case "branch":
                  return "Sucursal"
                case "invited":
                  return "Invitado"
                default:
                  return role
              }
            })()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email actual</Label>
          <div className="flex items-center gap-2">
            <Input type="email" value={user?.email || ""} disabled className="flex-1" />
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Cambiar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cambiar Email</DialogTitle>
                  <DialogDescription>
                    Ingresa tu nuevo email y tu contraseña actual para confirmar
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Nuevo Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      placeholder="nuevo@email.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      disabled={updatingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current-password-email">Contraseña Actual</Label>
                    <div className="relative">
                      <Input
                        id="current-password-email"
                        type={showPassword ? "text" : "password"}
                        placeholder="Tu contraseña actual"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={updatingProfile}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={updatingProfile}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEmailDialogOpen(false)
                      setNewEmail("")
                      setCurrentPassword("")
                    }}
                    disabled={updatingProfile}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateEmail} disabled={updatingProfile}>
                    {updatingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      "Actualizar Email"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Contraseña</Label>
          {hasEmailPassword ? (
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Lock className="h-4 w-4 mr-2" />
                  Cambiar Contraseña
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cambiar Contraseña</DialogTitle>
                <DialogDescription>
                  Ingresa tu contraseña actual y la nueva contraseña
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Contraseña Actual</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Tu contraseña actual"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={updatingProfile}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={updatingProfile}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nueva Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={updatingProfile}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={updatingProfile}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirma tu nueva contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={updatingProfile}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={updatingProfile}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasswordDialogOpen(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setConfirmPassword("")
                  }}
                  disabled={updatingProfile}
                >
                  Cancelar
                </Button>
                <Button onClick={handleUpdatePassword} disabled={updatingProfile}>
                  {updatingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    "Actualizar Contraseña"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground flex-1">
                  {hasGoogleAuth 
                    ? "Tu cuenta está vinculada con Google. Puedes agregar una contraseña para iniciar sesión con email y contraseña también."
                    : "No tienes una contraseña configurada. Agrega una para poder iniciar sesión con email y contraseña."}
                </p>
                <Dialog open={linkPasswordDialogOpen} onOpenChange={setLinkPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4 mr-2" />
                      Agregar Contraseña
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Contraseña</DialogTitle>
                      <DialogDescription>
                        Establece una contraseña para poder iniciar sesión con email y contraseña
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="link-password">Nueva Contraseña</Label>
                        <div className="relative">
                          <Input
                            id="link-password"
                            type={showLinkPassword ? "text" : "password"}
                            placeholder="Mínimo 6 caracteres"
                            value={linkPassword}
                            onChange={(e) => setLinkPassword(e.target.value)}
                            disabled={updatingProfile}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLinkPassword(!showLinkPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            disabled={updatingProfile}
                          >
                            {showLinkPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="link-confirm-password">Confirmar Contraseña</Label>
                        <div className="relative">
                          <Input
                            id="link-confirm-password"
                            type={showLinkConfirmPassword ? "text" : "password"}
                            placeholder="Confirma tu contraseña"
                            value={linkConfirmPassword}
                            onChange={(e) => setLinkConfirmPassword(e.target.value)}
                            disabled={updatingProfile}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLinkConfirmPassword(!showLinkConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            disabled={updatingProfile}
                          >
                            {showLinkConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setLinkPasswordDialogOpen(false)
                          setLinkPassword("")
                          setLinkConfirmPassword("")
                        }}
                        disabled={updatingProfile}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleLinkPassword} disabled={updatingProfile}>
                        {updatingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Vinculando...
                          </>
                        ) : (
                          "Agregar Contraseña"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}
        </div>

        {userData?.role === "invited" && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label>Referido</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={ownerEmail || userData?.ownerId || "No asignado"}
                  disabled
                  className="flex-1"
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

