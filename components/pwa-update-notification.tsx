"use client"

import { usePWAUpdate } from "@/hooks/use-pwa-update"
import { Button } from "@/components/ui/button"
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
import { RefreshCw } from "lucide-react"

interface PWAUpdateNotificationProps {
  swPath?: string
}

export function PWAUpdateNotification({ swPath = "/sw.js" }: PWAUpdateNotificationProps) {
  const { updateAvailable, updateServiceWorker } = usePWAUpdate(swPath)

  if (!updateAvailable) return null

  return (
    <AlertDialog open={updateAvailable} onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Actualización disponible
          </AlertDialogTitle>
          <AlertDialogDescription>
            Hay una nueva versión de la aplicación disponible. ¿Deseas actualizar ahora?
            La página se recargará automáticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {}}>
            Más tarde
          </AlertDialogCancel>
          <AlertDialogAction onClick={updateServiceWorker}>
            Actualizar ahora
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

