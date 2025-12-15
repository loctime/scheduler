"use client"

import { UserData, UserRole } from "@/hooks/use-admin-users"
import { Group } from "@/lib/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Mail, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"

interface UsersTableProps {
  users: UserData[]
  groups: Group[]
  getRoleBadgeColor: (role?: UserRole) => string
  getRoleLabel: (role?: UserRole) => string
  obtenerGruposDeUsuario: (userId: string) => Group[]
  onEdit: (usuario: UserData) => void
  onDelete: (usuario: UserData) => void
}

export function UsersTable({
  users,
  groups,
  getRoleBadgeColor,
  getRoleLabel,
  obtenerGruposDeUsuario,
  onEdit,
  onDelete,
}: UsersTableProps) {
  if (users.length === 0) {
    return null
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Nombre</TableHead>
                <TableHead className="min-w-[220px]">Email</TableHead>
                <TableHead className="min-w-[100px]">Rol</TableHead>
                <TableHead className="min-w-[120px]">Fecha Registro</TableHead>
                <TableHead className="min-w-[140px]">Grupos</TableHead>
                <TableHead className="min-w-[140px]">Invitado por</TableHead>
                <TableHead className="min-w-[100px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((usuario) => {
                const gruposUsuario = obtenerGruposDeUsuario(usuario.id)
                return (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">
                      {usuario.displayName || "Sin nombre"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate">{usuario.email || "Sin email"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getRoleBadgeColor(usuario.role)} whitespace-nowrap`}>
                        {getRoleLabel(usuario.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {usuario.createdAt ? (
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(usuario.createdAt.toDate(), "dd/MM/yyyy", { locale: es })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {gruposUsuario.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {gruposUsuario.map(grupo => (
                            <Badge key={grupo.id} variant="outline" className="text-xs whitespace-nowrap">
                              {grupo.nombre}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {usuario.ownerId ? (
                        <span className="text-sm text-muted-foreground font-mono">
                          {usuario.ownerId.substring(0, 12)}...
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(usuario)}
                          title="Editar usuario"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(usuario)}
                          title="Eliminar usuario"
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

