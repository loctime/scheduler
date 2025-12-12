"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Shield, Loader2, Search, UserPlus, Copy, Check, Users, Link as LinkIcon, Mail, FolderTree, Plus, Trash2, X } from "lucide-react"
import { Group } from "@/lib/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

export default function AdminPage() {
  const { user } = useData()
  const { users, loading, cambiarRol, buscarUsuarioPorEmail, recargarUsuarios } = useAdminUsers(user)
  const { groups, loading: loadingGroups, crearGrupo, eliminarGrupo, agregarUsuarioAGrupo, removerUsuarioDeGrupo, recargarGrupos } = useGroups(user)
  const { crearLinkInvitacion } = useInvitaciones(user)
  const { toast } = useToast()
  
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState<string>("todos")
  const [mostrarDialogLink, setMostrarDialogLink] = useState(false)
  const [rolLinkSeleccionado, setRolLinkSeleccionado] = useState<UserRole>("branch")
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
  
  // Estados para selector múltiple de usuarios
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<Record<string, string[]>>({}) // grupoId -> userIds[]
  const [agregandoUsuarios, setAgregandoUsuarios] = useState<Record<string, boolean>>({}) // grupoId -> boolean
  
  // Estado local para grupos (para actualizaciones reactivas)
  const [gruposLocales, setGruposLocales] = useState<Group[]>(groups)
  
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
  }

  const handleGenerarLink = async () => {
    if (!user) return

    setGenerandoLink(true)
    try {
      const link = await crearLinkInvitacion(rolLinkSeleccionado)
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

  const getRoleLabel = (role?: UserRole) => {
    switch (role) {
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
                  <Select value={rolLinkSeleccionado} onValueChange={(value) => setRolLinkSeleccionado(value as UserRole)}>
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
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="factory">Fábrica</SelectItem>
                  <SelectItem value="branch">Sucursal</SelectItem>
                  <SelectItem value="invited">Invitado</SelectItem>
                </SelectContent>
              </Select>
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
                        <Mail className="h-3 w-3 inline mr-1" />
                        {usuario.email || "Sin email"}
                      </p>
                      {usuario.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          Registrado: {format(usuario.createdAt.toDate(), "dd/MM/yyyy", { locale: es })}
                        </p>
                      )}
                      {usuario.ownerId && (
                        <p className="text-xs text-muted-foreground">
                          Invitado por: {usuario.ownerId.substring(0, 8)}...
                        </p>
                      )}
                      {(() => {
                        const gruposUsuario = obtenerGruposDeUsuario(usuario.id)
                        if (gruposUsuario.length > 0) {
                          return (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Grupos:</p>
                              <div className="flex flex-wrap gap-1">
                                {gruposUsuario.map(grupo => (
                                  <Badge key={grupo.id} variant="outline" className="text-xs">
                                    {grupo.nombre}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}
                      <div className="pt-2 border-t">
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
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="invited">Invitado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="grupos" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Gestión de Grupos</h2>
                <p className="text-sm text-muted-foreground">Crea y gestiona grupos de trabajo</p>
              </div>
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

            {loadingGroups ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : groups.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="text-xl">No hay grupos</CardTitle>
                  <CardDescription className="mt-2">
                    Crea tu primer grupo para organizar usuarios
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {gruposLocales.map((grupo) => {
                  const manager = users.find(u => u.id === grupo.managerId)
                  const usuariosGrupo = users.filter(u => grupo.userIds.includes(u.id))
                  return (
                    <Card key={grupo.id}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-semibold">{grupo.nombre}</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (confirm(`¿Eliminar el grupo "${grupo.nombre}"?`)) {
                              // Actualización optimista
                              setGruposLocales((prev: Group[]) => prev.filter((g: Group) => g.id !== grupo.id))
                              try {
                                await eliminarGrupo(grupo.id)
                                // Los grupos se sincronizarán automáticamente
                              } catch (error) {
                                // Revertir en caso de error
                                await recargarGrupos()
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm">
                          <strong>Gerente:</strong> {manager?.displayName || manager?.email || "No asignado"}
                        </p>
                        <p className="text-sm">
                          <strong>Usuarios:</strong> {usuariosGrupo.length}
                        </p>
                        <div className="space-y-2">
                          <label className="text-xs font-medium">Agregar usuarios al grupo:</label>
                          {(() => {
                            const usuariosDisponibles = users
                              .filter(u => (u.role === "branch" || u.role === "factory" || !u.role))
                              .filter(u => !grupo.userIds.includes(u.id))
                              .filter(u => u.id !== grupo.managerId) // Excluir al manager del grupo
                            
                            const seleccionados = usuariosSeleccionados[grupo.id] || []
                            
                            if (usuariosDisponibles.length === 0) {
                              return (
                                <p className="text-xs text-muted-foreground">
                                  No hay usuarios disponibles para agregar
                                </p>
                              )
                            }
                            
                            return (
                              <div className="space-y-2">
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
                                      onClick={async () => {
                                        if (seleccionados.length === 0) return
                                        
                                        setAgregandoUsuarios((prev: Record<string, boolean>) => ({ ...prev, [grupo.id]: true }))
                                        
                                        try {
                                          // Actualización optimista: actualizar estado local primero
                                          setGruposLocales((prev: Group[]) => prev.map((g: Group) => 
                                            g.id === grupo.id 
                                              ? { ...g, userIds: [...g.userIds, ...seleccionados] }
                                              : g
                                          ))
                                          
                                          // Agregar todos los usuarios seleccionados
                                          await Promise.all(
                                            seleccionados.map((userId: string) => agregarUsuarioAGrupo(grupo.id, userId))
                                          )
                                          
                                          // Limpiar selección
                                          setUsuariosSeleccionados((prev: Record<string, string[]>) => {
                                            const newState = { ...prev }
                                            delete newState[grupo.id]
                                            return newState
                                          })
                                          
                                          // Sincronizar con el servidor (sin recargar toda la página)
                                          await recargarGrupos()
                                        } catch (error) {
                                          console.error("Error al agregar usuarios:", error)
                                          // Revertir actualización optimista en caso de error
                                          await recargarGrupos()
                                          toast({
                                            title: "Error",
                                            description: "No se pudieron agregar todos los usuarios. Revirtiendo cambios...",
                                            variant: "destructive",
                                          })
                                        } finally {
                                          setAgregandoUsuarios((prev: Record<string, boolean>) => ({ ...prev, [grupo.id]: false }))
                                        }
                                      }}
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
                            )
                          })()}
                        </div>
                        {usuariosGrupo.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium mb-2">Usuarios del grupo:</p>
                            <div className="space-y-1">
                              {usuariosGrupo.map(user => (
                                <div key={user.id} className="flex items-center justify-between text-xs">
                                  <span>{user.displayName || user.email}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    onClick={async () => {
                                      // Actualización optimista: actualizar estado local primero
                                      setGruposLocales((prev: Group[]) => prev.map((g: Group) => 
                                        g.id === grupo.id 
                                          ? { ...g, userIds: g.userIds.filter((id: string) => id !== user.id) }
                                          : g
                                      ))
                                      
                                      try {
                                        await removerUsuarioDeGrupo(grupo.id, user.id)
                                        // Sincronizar con el servidor (sin recargar toda la página)
                                        await recargarGrupos()
                                      } catch (error) {
                                        console.error("Error al remover usuario:", error)
                                        // Revertir actualización optimista en caso de error
                                        await recargarGrupos()
                                        toast({
                                          title: "Error",
                                          description: "No se pudo remover el usuario. Revirtiendo cambios...",
                                          variant: "destructive",
                                        })
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
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
      </div>
    </DashboardLayout>
  )
}

