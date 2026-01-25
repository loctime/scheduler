import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { prepareElementForCapture } from "../dom/prepareElementForCapture"
import { restoreElementAfterCapture } from "../dom/restoreElementAfterCapture"
import { disablePseudoElements, enablePseudoElements } from "../dom/pseudoElements"

export const useExportImage = () => {
  const { toast } = useToast()

  const cleanFlexDivs = (element: HTMLElement) => {
    const cleaned: Array<{
      el: HTMLElement
      background: string
      border: string
      boxShadow: string
      display: string
      padding: string
    }> = []

    // Limpiar divs en las celdas (td)
    const cells = element.querySelectorAll("td")
    cells.forEach((td) => {
      const innerDivs = td.querySelectorAll("div.flex.flex-col, div.text-center")
      innerDivs.forEach((div) => {
        const el = div as HTMLElement
        cleaned.push({
          el,
          background: el.style.background || "",
          border: el.style.border || "",
          boxShadow: el.style.boxShadow || "",
          display: el.style.display || "",
          padding: el.style.padding || "",
        })

        el.style.background = "transparent"
        el.style.border = "none"
        el.style.boxShadow = "none"
        el.style.display = "block"
      })
    })

    // Limpiar divs en el header (th) - los que tienen "Lunes", "24 nov", etc.
    const headers = element.querySelectorAll("th")
    headers.forEach((th) => {
      const innerDivs = th.querySelectorAll("div.flex.flex-col, div.text-center")
      innerDivs.forEach((div) => {
        const el = div as HTMLElement
        cleaned.push({
          el,
          background: el.style.background || "",
          border: el.style.border || "",
          boxShadow: el.style.boxShadow || "",
          display: el.style.display || "",
          padding: el.style.padding || "",
        })

        el.style.background = "transparent"
        el.style.border = "none"
        el.style.boxShadow = "none"
        el.style.display = "block"
        el.style.padding = "4px 8px"  // Padding reducido para celdas más compactas
      })
      
      // También agregar padding a los spans dentro del header
      const spans = th.querySelectorAll("span")
      spans.forEach((span) => {
        const spanEl = span as HTMLElement
        if (spanEl.style) {
          cleaned.push({
            el: spanEl,
            background: spanEl.style.background || "",
            border: spanEl.style.border || "",
            boxShadow: spanEl.style.boxShadow || "",
            display: spanEl.style.display || "",
            padding: spanEl.style.padding || "",
          })
          spanEl.style.padding = "2px 4px"  // Padding reducido para más compacidad
        }
      })
    })

    return cleaned
  }

  const restoreFlexDivs = (cleaned: any[]) => {
    cleaned.forEach(({ el, background, border, boxShadow, display, padding }) => {
      el.style.background = background
      el.style.border = border
      el.style.boxShadow = boxShadow
      el.style.display = display
      el.style.padding = padding || ""
    })
  }

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
      
      const snapshot = prepareElementForCapture(htmlElement, cleanFlexDivs, config)

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

      restoreElementAfterCapture(htmlElement, snapshot, restoreFlexDivs)

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
