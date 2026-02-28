// Diálogo de Confirmación para Nueva Versión - Sistema de Versionado Inmutable
// Se muestra cuando el usuario intenta editar una semana completada

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
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState } from "react"
import { AlertTriangle, Copy, Edit } from "lucide-react"
import { CreateVersionDialogProps } from "@/lib/types/week-versioning-new"

export function CreateVersionDialog({
  isOpen,
  onClose,
  onConfirm,
  weekStatus,
  currentVersionNumber,
  isLoading = false
}: CreateVersionDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const isCompletedWeek = weekStatus === "completed"
  
  const handleConfirm = async (createNewVersion: boolean) => {
    setInternalLoading(true)
    try {
      await onConfirm(createNewVersion)
      onClose()
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isCompletedWeek ? (
              <>
                <Edit className="h-5 w-5" />
                Editar Semana Completada
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" />
                Crear Nueva Versión
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isCompletedWeek 
              ? "Esta semana está completada y es inmutable. Para editarla, debe crear una nueva versión."
              : "Está a punto de crear una nueva versión de esta semana."
            }
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Estado Actual */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Versión Actual:</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                v{currentVersionNumber}
              </Badge>
              <Badge variant={isCompletedWeek ? "default" : "secondary"}>
                {isCompletedWeek ? "Completada" : "Borrador"}
              </Badge>
            </div>
          </div>

          {/* Alerta informativa */}
          {isCompletedWeek && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> La versión actual permanecerá intacta 
                y se creará una nueva versión como copia para edición.
              </AlertDescription>
            </Alert>
          )}

          {/* Explicación del proceso */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• Se creará la versión <Badge variant="outline">v{currentVersionNumber + 1}</Badge></p>
            <p>• La nueva versión estará en modo <Badge variant="secondary">borrador</Badge></p>
            <p>• Podrá editarla sin restricciones</p>
            <p>• La versión completada se conservará en el historial</p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onClose()} disabled={internalLoading || isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleConfirm(true)}
            disabled={internalLoading || isLoading}
            className="min-w-[140px]"
          >
            {(internalLoading || isLoading) ? (
              "Creando..."
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Crear Versión
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
