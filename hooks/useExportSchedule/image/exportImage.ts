import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { exportScheduleAsImage } from "@/lib/export-schedule-image"

export const useExportImage = () => {
  const { toast } = useToast()

  const exportImage = useCallback(async (
    elementId: string, 
    filename: string,
    config?: {
      nombreEmpresa?: string
      colorEmpresa?: string
      download?: boolean
      showToast?: boolean
      onImageReady?: (blob: Blob, dataUrl: string) => Promise<void> | void
    }
  ) => {
    const element = document.getElementById(elementId)
    if (!element) {
      if (config?.showToast !== false) {
        toast({
          title: "Error",
          description: "No se encontró el elemento a exportar.",
          variant: "destructive",
        })
      }
      return
    }

    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      if (config?.showToast !== false) {
        toast({
          title: "Error",
          description: "El elemento no es visible.",
          variant: "destructive",
        })
      }
      return
    }

    try {
      // Usar el nuevo exportador profesional basado en clonación
      await exportScheduleAsImage(element as HTMLElement, filename)

      if (config?.showToast !== false) {
        toast({
          title: "OK",
          description: "Imagen exportada correctamente.",
        })
      }
    } catch (e) {
      console.error(e)
      if (config?.showToast !== false) {
        toast({
          title: "Error",
          description: "No se pudo exportar.",
          variant: "destructive",
        })
      }
    }
  }, [toast])

  return { exportImage }
}
