import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { prepareElementForCapture } from "../dom/prepareElementForCapture"
import { restoreElementAfterCapture } from "../dom/restoreElementAfterCapture"
import { disablePseudoElements, enablePseudoElements } from "../dom/pseudoElements"

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
    
    // Esperar un frame para que el overlay se renderice
    await new Promise((resolve) => requestAnimationFrame(resolve))
    
    const htmlElement = element as HTMLElement

    try {
      disablePseudoElements()
      
      const snapshot = prepareElementForCapture(htmlElement, config)

      const domtoimage = await import("dom-to-image-more")

      // Aumentar la escala para una imagen más grande y de mayor resolución
      const scale = 4 // Aumentar a 4x para mejor calidad y tamaño más grande
      
      // Usar el ancho real de la tabla, no del contenedor, más los márgenes
      const table = htmlElement.querySelector("table")
      const actualWidth = table ? table.scrollWidth : element.scrollWidth
      const actualHeight = table ? table.scrollHeight : element.scrollHeight
      
      const dataUrl = await domtoimage.toPng(htmlElement, {
        quality: 1.0,
        bgcolor: "#ffffff",
        width: (actualWidth + 20) * scale,
        height: (actualHeight + 20) * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        },
      })

      restoreElementAfterCapture(htmlElement, snapshot)

      const shouldDownload = config?.download !== false
      if (shouldDownload) {
        const link = document.createElement("a")
        link.download = filename
        link.href = dataUrl
        link.click()
      }

      const needsBlob = Boolean(config?.onImageReady)
      const blob = needsBlob ? await (await fetch(dataUrl)).blob() : null

      if (config?.onImageReady && blob) {
        await config.onImageReady(blob, dataUrl)
      }

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
    } finally {
      enablePseudoElements()
    }
  }, [toast])

  return { exportImage }
}
