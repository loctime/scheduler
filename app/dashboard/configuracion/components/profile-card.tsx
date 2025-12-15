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
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { Loader2, EyeOff, Eye, User, Mail, Lock } from "lucide-react"

export function ProfileCard() {
  const { user, userData } = useData()
  const { toast } = useToast()

  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [availableOwners, setAvailableOwners] = useState<Array<{ uid: string; email?: string; displayName?: string }>>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("")

  const loadAvailableOwners = async () => {
    if (!ownerDialogOpen || !db || userData?.role !== "invited") return

    try {
      const usersRef = collection(db, COLLECTIONS.USERS)
      const q = query(usersRef, where("role", "in", ["branch", "admin", "factory", "manager"]))
      const snapshot = await getDocs(q)

      const owners = snapshot.docs
        .map(doc => ({
          uid: doc.id,
          email: doc.data().email,
          displayName: doc.data().displayName,
        }))
        .filter(owner => owner.uid !== user?.uid)

      setAvailableOwners(owners)
      if (userData?.ownerId) {
        setSelectedOwnerId(userData.ownerId)
      }
    } catch (error) {
      console.error("Error cargando owners:", error)
    }
  }

  useEffect(() => {
    loadAvailableOwners()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerDialogOpen, userData, user, db])

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

  const handleUpdateOwner = async () => {
    if (!db || !user || userData?.role !== "invited") {
      toast({
        title: "Error",
        description: "Solo los usuarios invitados pueden cambiar su dueño",
        variant: "destructive",
      })
      return
    }

    if (!selectedOwnerId) {
      toast({
        title: "Error",
        description: "Por favor selecciona un dueño",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingProfile(true)
      const userRef = doc(db, COLLECTIONS.USERS, user.uid)
      await updateDoc(userRef, {
        ownerId: selectedOwnerId,
        updatedAt: serverTimestamp(),
      })

      toast({
        title: "Dueño actualizado",
        description: "Tu dueño ha sido actualizado exitosamente. Recarga la página para ver los cambios.",
      })

      setOwnerDialogOpen(false)
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el dueño",
        variant: "destructive",
      })
    } finally {
      setUpdatingProfile(false)
    }
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
        </div>

        {userData?.role === "invited" && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label>Dueño Actual</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={
                    availableOwners.find(o => o.uid === userData?.ownerId)?.email ||
                    userData?.ownerId ||
                    "No asignado"
                  }
                  disabled
                  className="flex-1"
                />
                <Dialog open={ownerDialogOpen} onOpenChange={setOwnerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <User className="h-4 w-4 mr-2" />
                      Cambiar Dueño
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cambiar Dueño</DialogTitle>
                      <DialogDescription>
                        Selecciona un nuevo dueño para tu cuenta. Esto cambiará a qué usuario estás vinculado.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="owner-select">Nuevo Dueño</Label>
                        <Select
                          value={selectedOwnerId}
                          onValueChange={setSelectedOwnerId}
                          disabled={updatingProfile}
                        >
                          <SelectTrigger id="owner-select">
                            <SelectValue placeholder="Selecciona un dueño" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOwners.map((owner) => (
                              <SelectItem key={owner.uid} value={owner.uid}>
                                {owner.displayName || owner.email || owner.uid}
                                {owner.email && ` (${owner.email})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOwnerDialogOpen(false)
                          setSelectedOwnerId(userData?.ownerId || "")
                        }}
                        disabled={updatingProfile}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleUpdateOwner} disabled={updatingProfile}>
                        {updatingProfile ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Actualizando...
                          </>
                        ) : (
                          "Actualizar Dueño"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

