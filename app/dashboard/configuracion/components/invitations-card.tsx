"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useInvitaciones } from "@/hooks/use-invitaciones"
import { useData } from "@/contexts/data-context"
import { InvitacionLink } from "@/lib/types"
import { Loader2, Copy, Link as LinkIcon, X } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

const PAGINAS_DISPONIBLES = [
  { id: "horarios", label: "Horarios" },
  { id: "pedidos", label: "Pedidos" },
  { id: "fabrica", label: "Fábrica" },
  { id: "empleados", label: "Empleados" },
  { id: "turnos", label: "Turnos" },
  { id: "configuracion", label: "Configuración" },
]

// Páginas disponibles según el rol del usuario que crea el link
const getPaginasDisponiblesPorRol = (rolUsuario?: string) => {
  if (rolUsuario === "manager" || rolUsuario === "admin") {
    // Gerente/Admin: todas las páginas
    return PAGINAS_DISPONIBLES
  } else if (rolUsuario === "branch" || rolUsuario === "factory") {
    // Sucursal/Fábrica: solo horarios, pedidos/fabrica, y configuracion
    return PAGINAS_DISPONIBLES.filter(p => 
      p.id === "horarios" || 
      p.id === "pedidos" || 
      p.id === "fabrica" || 
      p.id === "configuracion"
    )
  }
  // Por defecto, todas (aunque no debería llegar aquí)
  return PAGINAS_DISPONIBLES
}

export function InvitationsCard({ user }: { user: any }) {
  const { toast } = useToast()
  const { userData } = useData()
  const { links, loading: loadingLinks, crearLinkInvitacion, eliminarLink } = useInvitaciones(user, userData)
  const [linkAEliminar, setLinkAEliminar] = useState<InvitacionLink | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)
  
  // Determinar roles disponibles según el rol del usuario
  const getRolesDisponibles = (): readonly ("branch" | "factory" | "delivery" | "invited")[] => {
    if (userData?.role === "manager") {
      return ["branch", "factory", "delivery"] as const
    } else if (userData?.role === "branch" || userData?.role === "factory") {
      return ["invited"] as const
    }
    return [] as const
  }
  
  const rolesDisponibles = getRolesDisponibles()
  
  // Si solo hay un rol disponible, usarlo directamente; si no, usar "invited" como fallback
  const getRolPorDefecto = (): "branch" | "factory" | "admin" | "invited" | "manager" | "delivery" => {
    return rolesDisponibles.length > 0 ? rolesDisponibles[0] : "invited"
  }
  
  const [rolSeleccionado, setRolSeleccionado] = useState<"branch" | "factory" | "admin" | "invited" | "manager" | "delivery">(getRolPorDefecto())
  const [paginasSeleccionadas, setPaginasSeleccionadas] = useState<string[]>([])
  // Si el usuario es gerente, permitir crear links por defecto
  const [crearLinks, setCrearLinks] = useState(userData?.role === "manager" || userData?.permisos?.crearLinks === true)
  const [creando, setCreando] = useState(false)

  // Actualizar el estado cuando userData cambie
  useEffect(() => {
    if (userData?.role === "manager" || userData?.permisos?.crearLinks === true) {
      setCrearLinks(true)
    }
    // Actualizar rol seleccionado cuando cambie userData
    const nuevosRoles = getRolesDisponibles()
    if (nuevosRoles.length > 0) {
      setRolSeleccionado(nuevosRoles[0])
    } else {
      setRolSeleccionado("invited")
    }
  }, [userData])

  // Establece las páginas seleccionadas por defecto según el rol seleccionado
  const getDefaultPaginasForRol = (rol?: string) => {
    // Páginas disponibles por rol del CREADOR
    const disponiblesPorRol = getPaginasDisponiblesPorRol(userData?.role).map(p => p.id)
    // Si el creador tiene permisos explícitos, restringir a su lista
    const creadorPermisos = Array.isArray(userData?.permisos?.paginas) ? userData.permisos.paginas : null
    const permitidas = creadorPermisos ? disponiblesPorRol.filter(p => creadorPermisos.includes(p)) : disponiblesPorRol

    if (rol === "factory") {
      return permitidas.filter(p => p !== "pedidos")
    }
    if (rol === "branch") {
      return permitidas.filter(p => p !== "fabrica")
    }
    // Por defecto, seleccionar todas las permitidas
    return permitidas
  }

  // Cuando se abre el diálogo o cambia el rol seleccionado, inicializar checkboxes
  useEffect(() => {
    if (dialogAbierto) {
      setPaginasSeleccionadas(getDefaultPaginasForRol(rolSeleccionado))
    }
  }, [dialogAbierto, rolSeleccionado, userData?.role])

  // Construir las páginas que se mostrarán en el formulario: solo las que el creador puede asignar
  const paginasPermitablesPorCreador = (() => {
    const disponibles = getPaginasDisponiblesPorRol(userData?.role)
    const creadorPermisos = Array.isArray(userData?.permisos?.paginas) ? userData.permisos.paginas : null
    if (!creadorPermisos) return disponibles
    return disponibles.filter(p => creadorPermisos.includes(p.id))
  })()

  const copiarLink = (token: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/registro?token=${token}`
    navigator.clipboard.writeText(url)
    toast({
      title: "Link copiado",
      description: "El link de invitación ha sido copiado al portapapeles",
    })
  }

  const handleCrearLink = async () => {
    setCreando(true)
    try {
      // Filtrar las páginas para asegurarnos que el creador no otorgue páginas que no posee
      const paginasEnviables = paginasSeleccionadas.filter(p => paginasPermitablesPorCreador.some(pp => pp.id === p))
      const permisos = {
        paginas: paginasEnviables,
        crearLinks: crearLinks,
      }
      
      // El hook useInvitaciones ahora hereda automáticamente el grupoId del usuario
      // No necesitamos pasarlo explícitamente, pero lo podemos hacer si queremos forzar un grupo específico
      const link = await crearLinkInvitacion(rolSeleccionado, undefined, permisos)
      if (link) {
        copiarLink(link.token)
        setDialogAbierto(false)
        // Resetear formulario
        setRolSeleccionado(getRolPorDefecto())
        setPaginasSeleccionadas([])
        // Si el usuario es gerente, mantener crearLinks activado por defecto
        setCrearLinks(userData?.role === "manager" || userData?.permisos?.crearLinks === true)
      }
    } finally {
      setCreando(false)
    }
  }

  const togglePagina = (paginaId: string) => {
    setPaginasSeleccionadas(prev =>
      prev.includes(paginaId)
        ? prev.filter(p => p !== paginaId)
        : [...prev, paginaId]
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitaciones de Colaboradores</CardTitle>
        <CardDescription>
          Crea links únicos para invitar a tus compañeros de trabajo. Los usuarios invitados podrán acceder y modificar la página de pedidos desde sus propios dispositivos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Link de Invitación</DialogTitle>
              <DialogDescription>
                Configura el rol y los permisos para el nuevo colaborador
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Solo mostrar selector de rol si hay más de un rol disponible (gerente) */}
              {rolesDisponibles.length > 1 ? (
                <div className="space-y-2">
                  <Label>Rol del Usuario</Label>
                  <Select value={rolSeleccionado} onValueChange={(value) => setRolSeleccionado(value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rolesDisponibles.map((rol) => {
                        const labels: Record<string, string> = {
                          branch: "Sucursal",
                          factory: "Fábrica",
                          delivery: "Delivery",
                          invited: "Invitado",
                        }
                        return (
                          <SelectItem key={rol} value={rol}>
                            {labels[rol] || rol}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El rol determina los permisos base del usuario
                  </p>
                </div>
              ) : rolesDisponibles.length === 1 ? (
                // Si solo hay un rol disponible, mostrarlo como información
                <div className="space-y-2">
                  <Label>Rol del Usuario</Label>
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">
                      {rolSeleccionado === "invited" ? "Invitado" : rolSeleccionado}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Se creará un link para usuarios con rol de {rolSeleccionado === "invited" ? "Invitado" : rolSeleccionado}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <Label>Páginas Accesibles</Label>
                <div className="grid grid-cols-2 gap-3">
                  {paginasPermitablesPorCreador.map((pagina) => (
                    <div key={pagina.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`pagina-${pagina.id}`}
                        checked={paginasSeleccionadas.includes(pagina.id)}
                        onCheckedChange={() => togglePagina(pagina.id)}
                      />
                      <Label
                        htmlFor={`pagina-${pagina.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {pagina.label}
                        {pagina.id === "horarios" && (userData?.role === "branch" || userData?.role === "factory") && (
                          <span className="text-xs text-muted-foreground ml-1">(Vista mensual)</span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {userData?.role === "branch" || userData?.role === "factory" 
                    ? "Solo puedes seleccionar las páginas permitidas para tu rol"
                    : "Selecciona las páginas que el usuario podrá ver y usar"}
                </p>
              </div>

              {/* Solo mostrar opción de crear links si el usuario es gerente (no solo si tiene el permiso) */}
              {userData?.role === "manager" && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="crear-links"
                    checked={crearLinks}
                    onCheckedChange={(checked) => setCrearLinks(checked === true)}
                  />
                  <Label htmlFor="crear-links" className="text-sm font-normal cursor-pointer">
                    Permitir crear links de colaborador
                  </Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogAbierto(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCrearLink} disabled={creando}>
                {creando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Crear Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          type="button"
          variant="outline"
          onClick={() => setDialogAbierto(true)}
          className="w-full"
        >
          <LinkIcon className="mr-2 h-4 w-4" />
          Crear nuevo link de invitación
        </Button>

        {loadingLinks ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay links de invitación creados. Crea uno para empezar.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/registro?token=${link.token}`
              return (
                <div
                  key={link.id}
                  className="flex items-center gap-2 p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        link.activo && !link.usado
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : link.usado
                          ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}>
                        {link.usado ? "Usado" : link.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {url}
                    </p>
                    {link.role && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Rol: <span className="font-medium capitalize">{link.role}</span>
                      </p>
                    )}
                    {link.permisos && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <p className="font-medium">Permisos:</p>
                        {link.permisos.paginas && link.permisos.paginas.length > 0 && (
                          <p className="ml-2">
                            Páginas: {link.permisos.paginas.map(p => PAGINAS_DISPONIBLES.find(pa => pa.id === p)?.label || p).join(", ")}
                          </p>
                        )}
                        {link.permisos.crearLinks && (
                          <p className="ml-2">✓ Puede crear links</p>
                        )}
                      </div>
                    )}
                    {link.usado && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Vinculado por: <span className="font-medium">
                          {link.usadoPorEmail || "Cargando..."}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {link.activo && !link.usado && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copiarLink(link.token)}
                        className="h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLinkAEliminar(link)}
                      className="h-8 w-8 text-destructive"
                      title="Eliminar link y usuario vinculado"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!linkAEliminar} onOpenChange={(open) => !open && setLinkAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar link de invitación?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Esta acción eliminará permanentemente:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>El link de invitación</li>
                  {linkAEliminar?.usado && linkAEliminar?.usadoPorEmail && (
                    <li>
                      <strong>El usuario vinculado: {linkAEliminar.usadoPorEmail}</strong>
                    </li>
                  )}
                </ul>
                <p className="mt-2 font-semibold text-destructive">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (linkAEliminar) {
                  eliminarLink(linkAEliminar.id, true)
                  setLinkAEliminar(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

