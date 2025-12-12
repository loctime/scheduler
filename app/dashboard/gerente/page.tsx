"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useData } from "@/contexts/data-context"
import { useAdminUsers, UserRole, UserData } from "@/hooks/use-admin-users"
import { useGroups } from "@/hooks/use-groups"
import { useInvitaciones } from "@/hooks/use-invitaciones"
import { Users, Loader2, Search, UserPlus, Copy, Trash2, Link as LinkIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

export default function GerentePage() {
  const { user, userData } = useData()
  const { users, loading, cambiarRol, eliminarUsuario, recargarUsuarios } = useAdminUsers(user)
  const { groups, obtenerGruposComoManager } = useGroups(user)
  const { crearLinkInvitacion } = useInvitaciones(user)
  const { toast } = useToast()
  
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState<string>("todos")
  const [mostrarDialogLink, setMostrarDialogLink] = useState(false)
  const [rolLinkSeleccionado, setRolLinkSeleccionado] = useState<UserRole>("branch")
  const [linkGenerado, setLinkGenerado] = useState<string | null>(null)
  const [generandoLink, setGenerandoLink] = useState(false)

  // Obtener grupos donde el usuario es manager
  const misGrupos = useMemo(() => {
    if (!user?.uid) return []
    return obtenerGruposComoManager(user.uid)
  }, [groups, user, obtenerGruposComoManager])

  // Obtener IDs de grupos del manager
  const misGrupoIds = useMemo(() => {
    return misGrupos.map(g => g.id)
  }, [misGrupos])

  // Filtrar usuarios que pertenecen a los grupos del manager
  const usuariosDeMisGrupos = useMemo(() => {
    if (!userData || userData.role !== "manager") return []
    
    return users.filter(user => {
      // Incluir usuarios que tienen grupoIds que coinciden con los grupos del manager
      const userGrupoIds = user.grupoIds || []
      return userGrupoIds.some(grupoId => misGrupoIds.includes(grupoId))
    })
  }, [users, misGrupoIds, userData])

  const usuariosFiltrados = useMemo(() => {
    let filtrados = usuariosDeMisGrupos

    // Filtrar por búsqueda
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase()
      filtrados = filtrados.filter(user => 
        user.email?.toLowerCase().includes(busquedaLower) ||
        user.displayName?.toLowerCase().includes(busquedaLower) ||
        user.id.toLowerCase().includes(busquedaLower)
      )
    }

    // Filtrar por rol
    if (filtroRol !== "todos") {
      filtrados = filtrados.filter(user => user.role === filtroRol)
    }

    return filtrados
  }, [usuariosDeMisGrupos, busqueda, filtroRol])

  const handleCambiarRol = async (userId: string, nuevoRol: UserRole) => {
    // Manager solo puede cambiar a branch o factory
    if (nuevoRol !== "branch" && nuevoRol !== "factory") {
      toast({
        title: "Error",
        description: "Solo puedes asignar roles de Sucursal o Fábrica",
        variant: "destructive",
      })
      return
    }
    const exito = await cambiarRol(userId, nuevoRol)
    if (exito) {
      await recargarUsuarios()
    }
  }

  const handleEliminarUsuario = async (userId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      return
    }
    const exito = await eliminarUsuario(userId)
    if (exito) {
      await recargarUsuarios()
    }
  }

  const handleGenerarLink = async () => {
    if (!user || misGrupoIds.length === 0) {
      toast({
        title: "Error",
        description: "No tienes grupos asignados",
        variant: "destructive",
      })
      return
    }

    // Manager solo puede crear links para branch o factory
    if (rolLinkSeleccionado !== "branch" && rolLinkSeleccionado !== "factory") {
      toast({
        title: "Error",
        description: "Solo puedes crear links para Sucursal o Fábrica",
        variant: "destructive",
      })
      return
    }

    setGenerandoLink(true)
    try {
      // Usar el primer grupo del manager (podríamos permitir seleccionar grupo en el futuro)
      const grupoId = misGrupoIds[0]
      const link = await crearLinkInvitacion(rolLinkSeleccionado, grupoId)
      if (link) {
        const url = `${window.location.origin}/registro?token=${link.token}`
        setLinkGenerado(url)
      }
    } catch (error) {
      console.error("Error al generar link:", error)
    } finally {
      setGenerandoLink(false)
    }
  }

  const copiarLink = () => {
    if (linkGenerado) {
      navigator.clipboard.writeText(linkGenerado)
      toast({
        title: "Link copiado",
        description: "El link de registro ha sido copiado al portapapeles",
      })
    }
  }

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case "factory":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "branch":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getRoleLabel = (role?: UserRole) => {
    switch (role) {
      case "factory":
        return "Fábrica"
      case "branch":
        return "Sucursal"
      default:
        return "Sin rol"
    }
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (userData?.role !== "manager") {
    return (
      <DashboardLayout user={user}>
        <Card className="text-center py-12">
          <CardContent>
            <CardTitle className="text-xl">Acceso Denegado</CardTitle>
            <CardDescription className="mt-2">
              Solo los gerentes pueden acceder a esta página
            </CardDescription>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Panel de Gerente
            </h1>
            <p className="text-muted-foreground">
              Gestiona usuarios de tus grupos ({misGrupos.map(g => g.nombre).join(", ")})
            </p>
          </div>
          <Dialog open={mostrarDialogLink} onOpenChange={setMostrarDialogLink}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Crear Link de Registro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Link de Registro</DialogTitle>
                <DialogDescription>
                  Genera un link de registro para agregar nuevos usuarios a tus grupos. El usuario será asignado automáticamente al grupo "{misGrupos[0]?.nombre || "tu grupo"}".
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Rol a asignar</label>
                  <Select value={rolLinkSeleccionado} onValueChange={(value) => setRolLinkSeleccionado(value as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="branch">Sucursal</SelectItem>
                      <SelectItem value="factory">Fábrica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {linkGenerado ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Link generado:</label>
                    <div className="flex gap-2">
                      <Input value={linkGenerado} readOnly className="font-mono text-xs" />
                      <Button onClick={copiarLink} size="icon" variant="outline">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Comparte este link con el usuario. Al registrarse, se le asignará automáticamente el rol "{getRoleLabel(rolLinkSeleccionado)}" y será agregado a tu grupo.
                    </p>
                  </div>
                ) : (
                  <Button onClick={handleGenerarLink} disabled={generandoLink} className="w-full">
                    {generandoLink ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Generar Link
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroRol} onValueChange={setFiltroRol}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los roles</SelectItem>
              <SelectItem value="factory">Fábrica</SelectItem>
              <SelectItem value="branch">Sucursal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {usuariosFiltrados.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="text-xl">No hay usuarios en tus grupos</CardTitle>
              <CardDescription className="mt-2">
                {busqueda || filtroRol !== "todos"
                  ? "No se encontraron usuarios con los filtros aplicados"
                  : "Crea links de registro para agregar usuarios a tus grupos"}
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {usuariosFiltrados.map((usuario) => (
              <Card key={usuario.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold truncate max-w-[70%]">
                    {usuario.displayName || "Sin nombre"}
                  </CardTitle>
                  <Badge className={`text-xs ${getRoleBadgeColor(usuario.role)}`}>
                    {getRoleLabel(usuario.role)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground truncate">
                    {usuario.email || "Sin email"}
                  </p>
                  {usuario.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      Registrado: {format(usuario.createdAt.toDate(), "dd/MM/yyyy", { locale: es })}
                    </p>
                  )}
                  <div className="pt-2 border-t space-y-2">
                    <div>
                      <label className="text-xs font-medium mb-2 block">Cambiar rol:</label>
                      <Select
                        value={usuario.role || "branch"}
                        onValueChange={(value) => handleCambiarRol(usuario.id, value as UserRole)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="branch">Sucursal</SelectItem>
                          <SelectItem value="factory">Fábrica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => handleEliminarUsuario(usuario.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Usuario
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

