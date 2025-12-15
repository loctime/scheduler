"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Shield, Loader2, Search, UserPlus, Copy, Check, Users, Link as LinkIcon, Mail, FolderTree, Plus, Trash2, X, Pencil } from "lucide-react"
import { Group } from "@/lib/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { UsersTable } from "./components/users-table"
import { GroupsTable } from "./components/groups-table"

export default function AdminPage() {
  const { user, userData } = useData()
  const { users, loading, cambiarRol, eliminarUsuario, buscarUsuarioPorEmail, recargarUsuarios } = useAdminUsers(user)
  const { groups, loading: loadingGroups, crearGrupo, eliminarGrupo, agregarUsuarioAGrupo, removerUsuarioDeGrupo, recargarGrupos } = useGroups(user)
  const { crearLinkInvitacion } = useInvitaciones(user, userData)
  const { toast } = useToast()
  const puedeGestionarInvitaciones = userData?.role === "admin" || userData?.role === "manager"
  
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState<string>("todos")
  const [mostrarDialogLink, setMostrarDialogLink] = useState(false)
  const [rolLinkSeleccionado, setRolLinkSeleccionado] = useState<UserRole>("manager")
  const [linkGenerado, setLinkGenerado] = useState<string | null>(null)
  const [generandoLink, setGenerandoLink] = useState(false)
  const [busquedaEmail, setBusquedaEmail] = useState("")
  const [usuarioEncontrado, setUsuarioEncontrado] = useState<UserData | null>(null)
  const [buscandoEmail, setBuscandoEmail] = useState(false)
  
  // Estados para gestión de grupos
  const [mostrarDialogGrupo, setMostrarDialogGrupo] = useState(false)
  const [nombreGrupo, setNombreGrupo] = useState("")
  const [managerIdGrupo, setManagerIdGrupo] = useState<string>("")
  const [creandoGrupo, setCreandoGrupo] = useState(false)
  
  // Estados para creación de grupo al crear link de manager
  // Por defecto activado cuando el rol es manager
  const [crearGrupoConLink, setCrearGrupoConLink] = useState(true)
  const [nombreGrupoNuevo, setNombreGrupoNuevo] = useState("")
  
  // Estado local para grupos (para actualizaciones reactivas)
  const [gruposLocales, setGruposLocales] = useState<Group[]>(groups)
  
  // Estados para diálogos de edición y eliminación
  const [usuarioEditando, setUsuarioEditando] = useState<UserData | null>(null)
  const [usuarioEliminando, setUsuarioEliminando] = useState<UserData | null>(null)
  const [mostrarDialogEditar, setMostrarDialogEditar] = useState(false)
  const [mostrarDialogEliminar, setMostrarDialogEliminar] = useState(false)
  const [nuevoRol, setNuevoRol] = useState<UserRole>("branch")
  const [eliminando, setEliminando] = useState(false)
  
  // Sincronizar grupos locales con grupos del hook
  useEffect(() => {
    setGruposLocales(groups)
  }, [groups])
  
  // Función helper para obtener grupos de un usuario
  const obtenerGruposDeUsuario = useCallback((userId: string) => {
    return gruposLocales.filter(grupo => grupo.userIds.includes(userId))
  }, [gruposLocales])

  const usuariosFiltrados = useMemo(() => {
    let filtrados = users

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
  }, [users, busqueda, filtroRol])

  const handleCambiarRol = async (userId: string, nuevoRol: UserRole) => {
    const exito = await cambiarRol(userId, nuevoRol)
    if (exito) {
      // Recargar usuarios
      await recargarUsuarios()
    }
    return exito
  }

  const handleAbrirEditar = (usuario: UserData) => {
    setUsuarioEditando(usuario)
    setNuevoRol(usuario.role || "branch")
    setMostrarDialogEditar(true)
  }

  const handleGuardarEdicion = async () => {
    if (!usuarioEditando) return
    const exito = await handleCambiarRol(usuarioEditando.id, nuevoRol)
    if (exito) {
      setMostrarDialogEditar(false)
      setUsuarioEditando(null)
    }
  }

  const handleAbrirEliminar = (usuario: UserData) => {
    setUsuarioEliminando(usuario)
    setMostrarDialogEliminar(true)
  }

  const handleConfirmarEliminar = async () => {
    if (!usuarioEliminando) return
    setEliminando(true)
    const exito = await eliminarUsuario(usuarioEliminando.id)
    if (exito) {
      setMostrarDialogEliminar(false)
      setUsuarioEliminando(null)
    }
    setEliminando(false)
  }

  const handleGenerarLink = async () => {
    if (!user || !puedeGestionarInvitaciones) return

    // Si es manager y quiere crear grupo, validar nombre
    if (rolLinkSeleccionado === "manager" && crearGrupoConLink) {
      if (!nombreGrupoNuevo.trim()) {
        toast({
          title: "Error",
          description: "Por favor ingresa un nombre para el grupo",
          variant: "destructive",
        })
        return
      }
    }

    setGenerandoLink(true)
    try {
      let grupoIdCreado: string | null = null
      
      // Si es manager y quiere crear grupo, crearlo primero
      if (rolLinkSeleccionado === "manager" && crearGrupoConLink) {
        // Crear grupo sin managerId (se asignará cuando el gerente se registre)
        grupoIdCreado = await crearGrupo(nombreGrupoNuevo.trim(), "", "")
        if (!grupoIdCreado) {
          setGenerandoLink(false)
          return
        }
      }
      
      const link = await crearLinkInvitacion(rolLinkSeleccionado, grupoIdCreado || undefined)
      if (link) {
        const url = `${window.location.origin}/registro?token=${link.token}`
        setLinkGenerado(url)
        // Resetear estados
        setCrearGrupoConLink(false)
        setNombreGrupoNuevo("")
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

  const handleBuscarEmail = async () => {
    if (!busquedaEmail.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un email",
        variant: "destructive",
      })
      return
    }

    setBuscandoEmail(true)
    try {
      const usuario = await buscarUsuarioPorEmail(busquedaEmail.trim())
      setUsuarioEncontrado(usuario)
      if (!usuario) {
        toast({
          title: "Usuario no encontrado",
          description: "No se encontró ningún usuario con ese email",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error al buscar usuario:", error)
      toast({
        title: "Error",
        description: "No se pudo buscar el usuario",
        variant: "destructive",
      })
    } finally {
      setBuscandoEmail(false)
    }
  }

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "manager":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "factory":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "branch":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "invited":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role as UserRole) {
      case "admin":
        return "Administrador"
      case "factory":
        return "Fábrica"
      case "branch":
        return "Sucursal"
      case "invited":
        return "Invitado"
      default:
        return "Sin rol"
    }
  }

  const renderGruposContent = () => {
    if (loadingGroups) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }
    
    if (gruposLocales.length === 0) {
      return (
        <Card className="text-center py-12">
          <CardContent>
            <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="text-xl">No hay grupos</CardTitle>
            <CardDescription className="mt-2">
              Crea tu primer grupo para organizar usuarios
            </CardDescription>
          </CardContent>
        </Card>
      )
    }
    
    return (
      <GroupsTable
        groups={gruposLocales}
        users={users}
        getRoleLabel={getRoleLabel}
        onDelete={async (grupoId) => {
          const grupo = gruposLocales.find(g => g.id === grupoId)
          if (!grupo) return
          
          // Usar el mismo patrón de confirmación que usuarios
          if (window.confirm(`¿Eliminar el grupo "${grupo.nombre}"? Esta acción no se puede deshacer.`)) {
            setGruposLocales((prev: Group[]) => prev.filter((g: Group) => g.id !== grupoId))
            try {
              await eliminarGrupo(grupoId)
              await recargarGrupos()
              toast({
                title: "Grupo eliminado",
                description: `El grupo "${grupo.nombre}" ha sido eliminado exitosamente`,
              })
            } catch (error) {
              await recargarGrupos()
              toast({
                title: "Error",
                description: "No se pudo eliminar el grupo",
                variant: "destructive",
              })
            }
          }
        }}
        onAddUsers={async (grupoId, userIds) => {
          setGruposLocales((prev: Group[]) => prev.map((g: Group) => 
            g.id === grupoId 
              ? { ...g, userIds: [...g.userIds, ...userIds] }
              : g
          ))
          try {
            await Promise.all(
              userIds.map((userId: string) => agregarUsuarioAGrupo(grupoId, userId))
            )
            await recargarGrupos()
          } catch (error) {
            console.error("Error al agregar usuarios:", error)
            await recargarGrupos()
            toast({
              title: "Error",
              description: "No se pudieron agregar todos los usuarios. Revirtiendo cambios...",
              variant: "destructive",
            })
          }
        }}
        onRemoveUser={async (grupoId, userId) => {
          setGruposLocales((prev: Group[]) => prev.map((g: Group) => 
            g.id === grupoId 
              ? { ...g, userIds: g.userIds.filter((id: string) => id !== userId) }
              : g
          ))
          try {
            await removerUsuarioDeGrupo(grupoId, userId)
            await recargarGrupos()
          } catch (error) {
            console.error("Error al remover usuario:", error)
            await recargarGrupos()
            toast({
              title: "Error",
              description: "No se pudo remover el usuario. Revirtiendo cambios...",
              variant: "destructive",
            })
          }
        }}
      />
    )
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

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Panel de Administración
            </h1>
            <p className="text-muted-foreground">Gestiona usuarios y roles del sistema</p>
          </div>
          {puedeGestionarInvitaciones && (
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
                    Genera un link de registro con un rol específico. El usuario que use este link será asignado automáticamente con ese rol.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Rol a asignar</label>
                    <Select value={rolLinkSeleccionado} onValueChange={(value) => {
                      setRolLinkSeleccionado(value as UserRole)
                      // Activar opción de crear grupo si es manager, desactivar si no
                      if (value === "manager") {
                        setCrearGrupoConLink(true)
                      } else {
                        setCrearGrupoConLink(false)
                        setNombreGrupoNuevo("")
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="branch">Sucursal</SelectItem>
                        <SelectItem value="factory">Fábrica</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="admin">Administrador (Developer)</SelectItem>
                        <SelectItem value="invited">Invitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {rolLinkSeleccionado === "manager" && (
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="crear-grupo"
                          checked={crearGrupoConLink}
                          onCheckedChange={(checked) => {
                            setCrearGrupoConLink(checked === true)
                            if (!checked) {
                              setNombreGrupoNuevo("")
                            }
                          }}
                        />
                        <Label htmlFor="crear-grupo" className="text-sm font-medium cursor-pointer">
                          Crear grupo nuevo para este gerente
                        </Label>
                      </div>
                      {crearGrupoConLink && (
                        <div className="space-y-2">
                          <label htmlFor="nombre-grupo" className="text-sm font-medium">
                            Nombre del grupo
                          </label>
                          <Input
                            id="nombre-grupo"
                            placeholder="Ej: Grupo Norte, Sucursal Centro, etc."
                            value={nombreGrupoNuevo}
                            onChange={(e) => setNombreGrupoNuevo(e.target.value)}
                            disabled={generandoLink}
                          />
                          <p className="text-xs text-muted-foreground">
                            El grupo se creará automáticamente y el gerente será asignado como manager cuando se registre.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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
                        Comparte este link con el usuario. Al registrarse, se le asignará automáticamente el rol "{getRoleLabel(rolLinkSeleccionado)}".
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
          )}
        </div>

        <Tabs defaultValue="usuarios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="usuarios">
              <Users className="h-4 w-4 mr-2" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="grupos">
              <FolderTree className="h-4 w-4 mr-2" />
              Grupos
            </TabsTrigger>
            <TabsTrigger value="buscar">
              <Search className="h-4 w-4 mr-2" />
              Buscar por Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
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
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="factory">Fábrica</SelectItem>
                    <SelectItem value="branch">Sucursal</SelectItem>
                    <SelectItem value="invited">Invitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? "usuario" : "usuarios"}
              </div>
            </div>

            {usuariosFiltrados.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="text-xl">No hay usuarios</CardTitle>
                  <CardDescription className="mt-2">
                    {busqueda || filtroRol !== "todos"
                      ? "No se encontraron usuarios con los filtros aplicados"
                      : "Aún no hay usuarios registrados en el sistema"}
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              <UsersTable
                users={usuariosFiltrados}
                groups={gruposLocales}
                getRoleBadgeColor={getRoleBadgeColor}
                getRoleLabel={getRoleLabel}
                obtenerGruposDeUsuario={obtenerGruposDeUsuario}
                onEdit={handleAbrirEditar}
                onDelete={handleAbrirEliminar}
              />
            )}
          </TabsContent>

          <TabsContent value="grupos" className="space-y-4">
            <>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">Gestión de Grupos</h2>
                  <p className="text-sm text-muted-foreground">Crea y gestiona grupos de trabajo</p>
                </div>
                <div className="flex items-center gap-3">
                  {!loadingGroups && (
                    <div className="text-sm text-muted-foreground">
                      {gruposLocales.length} {gruposLocales.length === 1 ? "grupo" : "grupos"}
                    </div>
                  )}
                  <Dialog open={mostrarDialogGrupo} onOpenChange={setMostrarDialogGrupo}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear Grupo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Crear Nuevo Grupo</DialogTitle>
                        <DialogDescription>
                          Crea un nuevo grupo de trabajo y asigna un gerente
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Nombre del Grupo</label>
                          <Input
                            placeholder="Ej: Grupo Norte"
                            value={nombreGrupo}
                            onChange={(e) => setNombreGrupo(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Gerente</label>
                          <Select value={managerIdGrupo} onValueChange={setManagerIdGrupo}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar gerente" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.filter(u => u.role === "manager" || !u.role).map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.displayName || user.email} {user.role === "manager" && "(Manager)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={async () => {
                            if (!nombreGrupo.trim() || !managerIdGrupo) {
                              toast({
                                title: "Error",
                                description: "Completa todos los campos",
                                variant: "destructive",
                              })
                              return
                            }
                            setCreandoGrupo(true)
                            const manager = users.find(u => u.id === managerIdGrupo)
                            const grupoId = await crearGrupo(nombreGrupo, managerIdGrupo, manager?.email)
                            if (grupoId) {
                              setNombreGrupo("")
                              setManagerIdGrupo("")
                              setMostrarDialogGrupo(false)
                              // Actualizar grupoIds del manager
                              const managerData = users.find(u => u.id === managerIdGrupo)
                              if (managerData) {
                                const grupoIds = managerData.grupoIds || []
                                if (!grupoIds.includes(grupoId)) {
                                  // Esto se hará automáticamente cuando se actualice el grupo
                                }
                              }
                            }
                            setCreandoGrupo(false)
                          }}
                          disabled={creandoGrupo || !nombreGrupo.trim() || !managerIdGrupo}
                          className="w-full"
                        >
                          {creandoGrupo ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creando...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Crear Grupo
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {renderGruposContent()}
            </>
          </TabsContent>

          <TabsContent value="buscar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Buscar Usuario por Email</CardTitle>
                <CardDescription>
                  Busca un usuario existente por su email para cambiar su rol o sincronizar su cuenta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="email@ejemplo.com"
                    value={busquedaEmail}
                    onChange={(e) => setBusquedaEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleBuscarEmail()
                      }
                    }}
                    type="email"
                  />
                  <Button onClick={handleBuscarEmail} disabled={buscandoEmail || !busquedaEmail.trim()}>
                    {buscandoEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {usuarioEncontrado && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{usuarioEncontrado.displayName || "Sin nombre"}</span>
                        <Badge className={getRoleBadgeColor(usuarioEncontrado.role)}>
                          {getRoleLabel(usuarioEncontrado.role)}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">
                        <strong>Email:</strong> {usuarioEncontrado.email}
                      </p>
                      <p className="text-sm">
                        <strong>ID:</strong> <code className="text-xs">{usuarioEncontrado.id}</code>
                      </p>
                      {usuarioEncontrado.createdAt && (
                        <p className="text-sm">
                          <strong>Registrado:</strong> {format(usuarioEncontrado.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      )}
                      <div className="pt-2 border-t">
                        <label className="text-sm font-medium mb-2 block">Cambiar rol:</label>
                        <Select
                          value={usuarioEncontrado.role || "branch"}
                          onValueChange={(value) => {
                            handleCambiarRol(usuarioEncontrado.id, value as UserRole)
                            setUsuarioEncontrado({ ...usuarioEncontrado, role: value as UserRole })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                  <SelectItem value="branch">Sucursal</SelectItem>
                  <SelectItem value="factory">Fábrica</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="invited">Invitado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog de edición de usuario */}
        <Dialog open={mostrarDialogEditar} onOpenChange={setMostrarDialogEditar}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>
                Cambia el rol del usuario {usuarioEditando?.displayName || usuarioEditando?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Rol:</label>
                <Select value={nuevoRol} onValueChange={(value) => setNuevoRol(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branch">Sucursal</SelectItem>
                    <SelectItem value="factory">Fábrica</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="invited">Invitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMostrarDialogEditar(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleGuardarEdicion}>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmación de eliminación */}
        <AlertDialog open={mostrarDialogEliminar} onOpenChange={setMostrarDialogEliminar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el usuario{" "}
                <strong>{usuarioEliminando?.displayName || usuarioEliminando?.email}</strong> del sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={eliminando}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmarEliminar}
                disabled={eliminando}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {eliminando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}

