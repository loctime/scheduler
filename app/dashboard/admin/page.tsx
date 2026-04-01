"use client"

import { useState } from "react"
import { useData } from "@/contexts/data-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAdminUsers } from "@/hooks/use-admin-users"
import { canUser } from "@/lib/permissions"

const ROLES = ["operador", "admin", "delivery"] as const

export default function AdminPage() {
  const { user, userData } = useData()
  const { users, loading, cambiarRol, actualizarLocationId } = useAdminUsers(user)
  const [savingId, setSavingId] = useState<string | null>(null)

  const canView = canUser({ uid: user?.uid, role: userData?.role, locationId: userData?.locationId }, "ver_admin")
  if (!canView) {
    return (
      <DashboardLayout user={user}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-700">Acceso denegado</h2>
            <p className="mt-2 text-sm text-red-600">No tienes permisos para ver esta seccion.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <Card>
        <CardHeader>
          <CardTitle>Administracion de usuarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-sm text-muted-foreground">Cargando usuarios...</div>}
          {!loading && users.length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              No hay usuarios para mostrar.
            </div>
          )}
          {users.map((u) => (
            <div key={u.id} className="rounded-md border p-3">
              <div className="text-sm font-medium">{u.displayName || u.email || u.uid}</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Rol</div>
                  <Select
                    value={u.role || "operador"}
                    onValueChange={async (value) => {
                      setSavingId(u.id)
                      await cambiarRol(u.id, value as any)
                      setSavingId(null)
                    }}
                  >
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
                <div>
                  <div className="text-xs text-muted-foreground">LocationId</div>
                  <Input
                    defaultValue={u.locationId || ""}
                    onBlur={async (e) => {
                      if (e.target.value === (u.locationId || "")) return
                      setSavingId(u.id)
                      await actualizarLocationId(u.id, e.target.value.trim())
                      setSavingId(null)
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="outline" disabled={savingId === u.id} className="w-full">
                    {savingId === u.id ? "Guardando..." : "Actualizado"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
