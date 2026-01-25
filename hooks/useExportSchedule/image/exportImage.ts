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
    config?: { nombreEmpresa?: string; colorEmpresa?: string; ownerId?: string }
  ) => {
    const element = document.getElementById(elementId)
    if (!element) {
      toast({
        title: "Error",
        description: "No se encontró el elemento a exportar.",
        variant: "destructive",
      })
      return
    }

    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      toast({
        title: "Error",
        description: "El elemento no es visible.",
        variant: "destructive",
      })
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

      const link = document.createElement("a")
      link.download = filename
      link.href = dataUrl
      link.click()

      // Subir al backend siempre que haya ownerId (indica exportación de semana completa)
      // Validar que ownerId sea un string no vacío para evitar enviar valores inválidos
      if (config?.ownerId && typeof config.ownerId === 'string' && config.ownerId.trim() !== '') {
        try {
          const ownerId = config.ownerId.trim()

          const response = await fetch(dataUrl)
          const blob = await response.blob()

          const formData = new FormData()
          formData.append("file", blob, "semana-actual.png")
          // Agregar ownerId explícitamente al FormData para asegurar consistencia
          formData.append("ownerId", ownerId)

          await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/horarios/semana-actual?ownerId=${encodeURIComponent(ownerId)}`,
            {
              method: "POST",
              body: formData,
            }
          )
        } catch (error) {
          console.warn('Error al subir imagen al backend:', error)
        }
      }

      toast({
        title: "OK",
        description: "Imagen exportada correctamente.",
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: "No se pudo exportar.",
        variant: "destructive",
      })
    } finally {
      enablePseudoElements()
    }
  }, [toast])

  return { exportImage }
}
