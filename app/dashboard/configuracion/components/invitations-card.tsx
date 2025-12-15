"use client"

import { useState } from "react"
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

export function InvitationsCard({ user }: { user: any }) {
  const { toast } = useToast()
  const { userData } = useData()
  const { links, loading: loadingLinks, crearLinkInvitacion, eliminarLink } = useInvitaciones(user, userData)
  const [linkAEliminar, setLinkAEliminar] = useState<InvitacionLink | null>(null)
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [rolSeleccionado, setRolSeleccionado] = useState<"branch" | "factory" | "admin" | "invited" | "manager">("invited")
  const [paginasSeleccionadas, setPaginasSeleccionadas] = useState<string[]>([])
  const [crearLinks, setCrearLinks] = useState(false)
  const [creando, setCreando] = useState(false)

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
      const permisos = {
        paginas: paginasSeleccionadas,
        crearLinks: crearLinks,
      }
      
      // El hook useInvitaciones ahora hereda automáticamente el grupoId del usuario
      // No necesitamos pasarlo explícitamente, pero lo podemos hacer si queremos forzar un grupo específico
      const link = await crearLinkInvitacion(rolSeleccionado, undefined, permisos)
      if (link) {
        copiarLink(link.token)
        setDialogAbierto(false)
        // Resetear formulario
        setRolSeleccionado("invited")
        setPaginasSeleccionadas([])
        setCrearLinks(false)
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
              <div className="space-y-2">
                <Label>Rol del Usuario</Label>
                <Select value={rolSeleccionado} onValueChange={(value) => setRolSeleccionado(value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invited">Invitado</SelectItem>
                    <SelectItem value="branch">Sucursal</SelectItem>
                    <SelectItem value="factory">Fábrica</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  El rol determina los permisos base del usuario
                </p>
              </div>

              <div className="space-y-3">
                <Label>Páginas Accesibles</Label>
                <div className="grid grid-cols-2 gap-3">
                  {PAGINAS_DISPONIBLES.map((pagina) => (
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
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecciona las páginas que el usuario podrá ver y usar
                </p>
              </div>

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

