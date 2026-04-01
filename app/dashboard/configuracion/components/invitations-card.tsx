"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInvitaciones } from "@/hooks/use-invitaciones"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/data-context"

const ROLES = ["operador", "admin", "delivery"] as const

type Role = (typeof ROLES)[number]

export function InvitationsCard() {
  const { user, userData } = useData()
  const { toast } = useToast()
  const { links, loading, crearLinkInvitacion } = useInvitaciones(user, userData)
  const [rolSeleccionado, setRolSeleccionado] = useState<Role>("operador")
  const [locationId, setLocationId] = useState("")
  const [creando, setCreando] = useState(false)

  const handleCreate = async () => {
    if (!user) return
    setCreando(true)
    try {
      const link = await crearLinkInvitacion(rolSeleccionado, locationId.trim() || undefined)
      if (link?.token) {
        navigator.clipboard.writeText(link.token).catch(() => null)
        toast({ title: "Link creado", description: "Token copiado al portapapeles" })
      }
    } finally {
      setCreando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Rol</label>
            <Select value={rolSeleccionado} onValueChange={(value) => setRolSeleccionado(value as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((rol) => (
                  <SelectItem key={rol} value={rol}>
                    {rol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">LocationId</label>
            <Input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Opcional" />
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
                Rol: {link.role || "operador"} {link.locationId ? ` - Location: ${link.locationId}` : ""}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

