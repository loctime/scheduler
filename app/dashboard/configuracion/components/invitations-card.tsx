"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useInvitaciones } from "@/hooks/use-invitaciones"
import { InvitacionLink } from "@/lib/types"
import { Loader2, Copy, Link as LinkIcon, X } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

export function InvitationsCard({ user }: { user: any }) {
  const { toast } = useToast()
  const { links, loading: loadingLinks, crearLinkInvitacion, eliminarLink } = useInvitaciones(user)
  const [linkAEliminar, setLinkAEliminar] = useState<InvitacionLink | null>(null)

  const copiarLink = (token: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/registro?token=${token}`
    navigator.clipboard.writeText(url)
    toast({
      title: "Link copiado",
      description: "El link de invitación ha sido copiado al portapapeles",
    })
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
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            const link = await crearLinkInvitacion()
            if (link) {
              copiarLink(link.token)
            }
          }}
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

