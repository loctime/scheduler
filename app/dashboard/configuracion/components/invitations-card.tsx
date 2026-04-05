"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Copy, Trash2, UserX } from "lucide-react"
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

  const handleCreate = async () => {
    if (!user) return
    const fixedLocationId = userData?.locationId || ""
    if (!fixedLocationId.trim()) {
      toast({ title: "Error", description: "LocationId es obligatorio.", variant: "destructive" })
      return
    }
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <Badge className="w-fit border-transparent bg-emerald-600 text-white hover:bg-emerald-600">
                        Vinculado
                      </Badge>
                      <span className="truncate text-sm font-medium">{link.usedByEmail ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">Rol: {link.role}</span>
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
