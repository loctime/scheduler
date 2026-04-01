"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInvitaciones } from "@/hooks/use-invitaciones"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"

const ROLES_BASE = ["operador", "delivery"] as const
const ROLES_ADMIN = ["operador", "delivery", "admin"] as const

type Role = (typeof ROLES_ADMIN)[number]

export function InvitationsCard() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const { links, loading, crearLinkInvitacion } = useInvitaciones(user, userData)
  const [rolSeleccionado, setRolSeleccionado] = useState<Role>("operador")
  const [creando, setCreando] = useState(false)

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
        navigator.clipboard.writeText(link.token).catch(() => null)
        toast({ title: "Link creado", description: "Token copiado al portapapeles" })
      }
    } finally {
      setCreando(false)
    }
  }

  const rolesDisponibles = userData?.role === "admin" ? ROLES_ADMIN : ROLES_BASE

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
          {links.map((link) => (
            <div key={link.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">Token: {link.token}</div>
              <div className="text-xs text-muted-foreground">
                Rol: {link.role} - Location: {link.locationId}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
