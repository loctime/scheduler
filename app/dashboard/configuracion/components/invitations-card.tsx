"use client"

import { useState, useEffect, useMemo } from "react"
import { getDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useInvitaciones } from "@/hooks/use-invitaciones"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"
import { db, COLLECTIONS } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import { Copy, Trash2, UserX, Pencil, Check, X } from "lucide-react"
import type { InvitacionLink } from "@/lib/types"

const ROLES_BASE = ["operador", "delivery"] as const

function invitationFullLink(token: string) {
  return `${window.location.origin}/registro?token=${token}`
}
const ROLES_ADMIN = ["operador", "delivery", "admin"] as const

type Role = (typeof ROLES_ADMIN)[number]

function invitacionUsada(link: InvitacionLink) {
  return Boolean(link.usedBy)
}

export function InvitationsCard() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const { links, loading, crearLinkInvitacion, eliminarLink, desactivarUsuario } = useInvitaciones(user, userData)
  const [rolSeleccionado, setRolSeleccionado] = useState<Role>("operador")
  const [creando, setCreando] = useState(false)
  const [desactivando, setDesactivando] = useState(false)
  const [confirmDesactivar, setConfirmDesactivar] = useState<{
    usedBy: string
    email: string
  } | null>(null)
  const [locationNamesByUserId, setLocationNamesByUserId] = useState<Record<string, string>>({})
  const [editingLocationUserId, setEditingLocationUserId] = useState<string | null>(null)
  const [locationEditDraft, setLocationEditDraft] = useState("")
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false)

  const usedByIdsKey = useMemo(() => {
    const ids = [...new Set(links.map((l) => l.usedBy).filter(Boolean))] as string[]
    return ids.sort().join("|")
  }, [links])

  useEffect(() => {
    if (!db || loading) return
    const firestore = db
    if (!usedByIdsKey) {
      setLocationNamesByUserId({})
      return
    }
    const userIds = usedByIdsKey.split("|")
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        userIds.map(async (uid) => {
          const snap = await getDoc(doc(firestore, COLLECTIONS.USERS, uid))
          const data = snap.exists() ? (snap.data() as { locationName?: string }) : null
          const raw = typeof data?.locationName === "string" ? data.locationName : ""
          return [uid, raw] as const
        })
      )
      if (cancelled) return
      setLocationNamesByUserId(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [loading, usedByIdsKey])

  const handleCreate = async () => {
    if (!user) return
    const fixedLocationId = `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    setCreando(true)
    try {
      const link = await crearLinkInvitacion(rolSeleccionado, fixedLocationId.trim())
      if (link?.token) {
        const fullLink = invitationFullLink(link.token)
        navigator.clipboard.writeText(fullLink).catch(() => null)
        toast({ title: "Link copiado al portapapeles" })
      }
    } finally {
      setCreando(false)
    }
  }

  const rolesDisponibles = userData?.role === "admin" ? ROLES_ADMIN : ROLES_BASE

  const handleConfirmDesactivar = async () => {
    if (!confirmDesactivar) return
    setDesactivando(true)
    try {
      await desactivarUsuario(confirmDesactivar.usedBy)
      setConfirmDesactivar(null)
    } finally {
      setDesactivando(false)
    }
  }

  const iniciarEdicionUbicacion = (userId: string) => {
    setEditingLocationUserId(userId)
    setLocationEditDraft(locationNamesByUserId[userId] ?? "")
  }

  const cancelarEdicionUbicacion = () => {
    setEditingLocationUserId(null)
    setLocationEditDraft("")
  }

  const guardarUbicacion = async (userId: string) => {
    if (!db) return
    const firestore = db
    const valor = locationEditDraft.trim()
    setGuardandoUbicacion(true)
    try {
      await updateDoc(doc(firestore, COLLECTIONS.USERS, userId), {
        locationName: valor,
        updatedAt: serverTimestamp(),
      })
      setLocationNamesByUserId((prev) => ({ ...prev, [userId]: valor }))
      setEditingLocationUserId(null)
      setLocationEditDraft("")
      toast({ title: "Ubicación guardada" })
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo guardar la ubicación",
        variant: "destructive",
      })
    } finally {
      setGuardandoUbicacion(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Rol</label>
            <Select value={rolSeleccionado} onValueChange={(value) => setRolSeleccionado(value as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolesDisponibles.map((rol) => (
                  <SelectItem key={rol} value={rol}>
                    {rol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreate} disabled={creando || !user} className="w-full">
              {creando ? "Creando..." : "Crear link"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {loading && <div className="text-sm text-muted-foreground">Cargando links...</div>}
          {!loading && links.length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No hay invitaciones activas.
            </div>
          )}
          {links.map((link) => {
            const usada = invitacionUsada(link)
            return (
              <div key={link.id} className="rounded-md border p-3 text-sm">
                {!usada && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        Pendiente
                      </Badge>
                      <span className="text-xs text-muted-foreground">Rol: {link.role}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          const fullLink = invitationFullLink(link.token)
                          navigator.clipboard.writeText(fullLink).catch(() => null)
                          toast({ title: "Link copiado" })
                        }}
                      >
                        <Copy className="size-4" aria-hidden />
                        Copiar link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => eliminarLink(link.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                )}
                {usada && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="w-fit border-transparent bg-emerald-600 text-white hover:bg-emerald-600">
                          Vinculado
                        </Badge>
                        <span className="truncate text-sm font-medium">{link.usedByEmail ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">Rol: {link.role}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Ubicación:</span>
                        {editingLocationUserId === link.usedBy ? (
                          <>
                            <Input
                              value={locationEditDraft}
                              onChange={(e) => setLocationEditDraft(e.target.value)}
                              className="h-8 max-w-[220px] text-sm"
                              disabled={guardandoUbicacion}
                              placeholder="Sin nombre de ubicación"
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="size-8 shrink-0"
                              disabled={guardandoUbicacion}
                              onClick={() => guardarUbicacion(link.usedBy!)}
                              aria-label="Guardar ubicación"
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 shrink-0"
                              disabled={guardandoUbicacion}
                              onClick={cancelarEdicionUbicacion}
                              aria-label="Cancelar edición"
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5",
                                !(locationNamesByUserId[link.usedBy!] ?? "").trim() &&
                                  "text-muted-foreground italic"
                              )}
                            >
                              {`[ ${(locationNamesByUserId[link.usedBy!] ?? "").trim() || "Sin nombre de ubicación"} ]`}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 shrink-0 text-muted-foreground"
                              onClick={() => iniciarEdicionUbicacion(link.usedBy!)}
                              aria-label="Editar nombre de ubicación"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        setConfirmDesactivar({
                          usedBy: link.usedBy!,
                          email: link.usedByEmail ?? "este usuario",
                        })
                      }
                    >
                      <UserX className="size-4" aria-hidden />
                      Desactivar cuenta
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <AlertDialog open={!!confirmDesactivar} onOpenChange={(open) => !open && setConfirmDesactivar(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desactivar cuenta</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Desactivar a {confirmDesactivar?.email}? El usuario no podrá acceder a la aplicación.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={desactivando}>Cancelar</AlertDialogCancel>
              <Button variant="destructive" disabled={desactivando} onClick={handleConfirmDesactivar}>
                {desactivando ? "Procesando..." : "Confirmar"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
