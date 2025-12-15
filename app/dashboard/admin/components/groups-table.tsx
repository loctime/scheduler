"use client"

import { UserData } from "@/hooks/use-admin-users"
import { Group } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, Trash2, Plus, X, Loader2 } from "lucide-react"
import { useState } from "react"

interface GroupsTableProps {
  groups: Group[]
  users: UserData[]
  getRoleLabel: (role?: string) => string
  onDelete: (grupoId: string) => Promise<void>
  onAddUsers: (grupoId: string, userIds: string[]) => Promise<void>
  onRemoveUser: (grupoId: string, userId: string) => Promise<void>
}

export function GroupsTable({
  groups,
  users,
  getRoleLabel,
  onDelete,
  onAddUsers,
  onRemoveUser,
}: GroupsTableProps) {
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<Record<string, string[]>>({})
  const [agregandoUsuarios, setAgregandoUsuarios] = useState<Record<string, boolean>>({})
  const [grupoExpandidoAgregar, setGrupoExpandidoAgregar] = useState<string | null>(null)
  const [grupoExpandidoVer, setGrupoExpandidoVer] = useState<string | null>(null)

  const handleAgregarUsuarios = async (grupoId: string) => {
    const seleccionados = usuariosSeleccionados[grupoId] || []
    if (seleccionados.length === 0) return

    setAgregandoUsuarios(prev => ({ ...prev, [grupoId]: true }))
    try {
      await onAddUsers(grupoId, seleccionados)
      setUsuariosSeleccionados(prev => {
        const newState = { ...prev }
        delete newState[grupoId]
        return newState
      })
    } finally {
      setAgregandoUsuarios(prev => ({ ...prev, [grupoId]: false }))
    }
  }

  if (groups.length === 0) {
    return null
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Nombre</TableHead>
                <TableHead className="min-w-[200px]">Gerente</TableHead>
                <TableHead className="min-w-[100px]">Usuarios</TableHead>
                <TableHead className="min-w-[300px]">Acciones</TableHead>
                <TableHead className="min-w-[100px] text-right">Eliminar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((grupo) => {
                const manager = users.find(u => u.id === grupo.managerId)
                const usuariosGrupo = users.filter(u => grupo.userIds.includes(u.id))
                const usuariosDisponibles = users
                  .filter(u => (u.role === "branch" || u.role === "factory" || !u.role))
                  .filter(u => !grupo.userIds.includes(u.id))
                  .filter(u => u.id !== grupo.managerId)
                const seleccionados = usuariosSeleccionados[grupo.id] || []
                const estaExpandidoAgregar = grupoExpandidoAgregar === grupo.id
                const estaExpandidoVer = grupoExpandidoVer === grupo.id

                return (
                  <TableRow key={grupo.id}>
                    <TableCell className="font-medium">
                      {grupo.nombre}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {manager?.displayName || manager?.email || "No asignado"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{usuariosGrupo.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {usuariosDisponibles.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setGrupoExpandidoAgregar(estaExpandidoAgregar ? null : grupo.id)
                                if (estaExpandidoAgregar) {
                                  setUsuariosSeleccionados(prev => {
                                    const newState = { ...prev }
                                    delete newState[grupo.id]
                                    return newState
                                  })
                                }
                              }}
                            >
                              {estaExpandidoAgregar ? "Ocultar" : "Agregar usuarios"}
                            </Button>
                          )}
                          {usuariosGrupo.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setGrupoExpandidoVer(estaExpandidoVer ? null : grupo.id)}
                            >
                              {estaExpandidoVer ? "Ocultar" : `Ver usuarios (${usuariosGrupo.length})`}
                            </Button>
                          )}
                        </div>
                        {estaExpandidoAgregar && usuariosDisponibles.length > 0 && (
                          <div className="space-y-2 p-2 border rounded-md bg-muted/30">
                            <Select
                              onValueChange={(userId) => {
                                if (!seleccionados.includes(userId)) {
                                  setUsuariosSeleccionados(prev => ({
                                    ...prev,
                                    [grupo.id]: [...seleccionados, userId]
                                  }))
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Seleccionar usuarios..." />
                              </SelectTrigger>
                              <SelectContent>
                                {usuariosDisponibles
                                  .filter(u => !seleccionados.includes(u.id))
                                  .map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.displayName || user.email} {user.role && `(${getRoleLabel(user.role)})`}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            
                            {seleccionados.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {seleccionados.map(userId => {
                                    const user = users.find(u => u.id === userId)
                                    if (!user) return null
                                    return (
                                      <Badge key={userId} variant="secondary" className="text-xs flex items-center gap-1">
                                        {user.displayName || user.email}
                                        <button
                                          onClick={() => {
                                            setUsuariosSeleccionados(prev => ({
                                              ...prev,
                                              [grupo.id]: seleccionados.filter(id => id !== userId)
                                            }))
                                          }}
                                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    )
                                  })}
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full h-7 text-xs"
                                  onClick={() => handleAgregarUsuarios(grupo.id)}
                                  disabled={agregandoUsuarios[grupo.id] || seleccionados.length === 0}
                                >
                                  {agregandoUsuarios[grupo.id] ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Agregando...
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      Agregar {seleccionados.length} usuario{seleccionados.length > 1 ? 's' : ''}
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {estaExpandidoVer && usuariosGrupo.length > 0 && (
                          <div className="p-2 border rounded-md bg-muted/30 space-y-1">
                            <p className="text-xs font-medium mb-1">Usuarios del grupo:</p>
                            {usuariosGrupo.map(user => (
                              <div key={user.id} className="flex items-center justify-between text-xs">
                                <span>{user.displayName || user.email}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => onRemoveUser(grupo.id, user.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(grupo.id)}
                          title="Eliminar grupo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

