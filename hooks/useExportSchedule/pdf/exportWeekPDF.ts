import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { prepareElementForCapture } from "../dom/prepareElementForCapture"
import { restoreElementAfterCapture } from "../dom/restoreElementAfterCapture"
import { disablePseudoElements, enablePseudoElements } from "../dom/pseudoElements"

export const useExportWeekPDF = () => {
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

  const exportPDF = useCallback(async (
    elementId: string, 
    filename: string,
    config?: { nombreEmpresa?: string; colorEmpresa?: string }
  ) => {
    const element = document.getElementById(elementId)
    if (!element) return

    // Esperar un frame para que el overlay se renderice
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const htmlElement = element as HTMLElement

    try {
      disablePseudoElements()
      
      const snapshot = prepareElementForCapture(htmlElement, cleanFlexDivs, config)

      const [domtoimage, jsPDF] = await Promise.all([
        import("dom-to-image-more"),
        import("jspdf").then(m => m.default),
      ])

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

      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()

      const img = new Image()
      img.src = dataUrl
      await new Promise(res => (img.onload = res))

      const pdfHeight = (img.height * pdfWidth) / img.width
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(filename)

      toast({
        title: "PDF exportado",
        description: "Se generó correctamente.",
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: "No se pudo exportar el PDF.",
        variant: "destructive",
      })
    } finally {
      enablePseudoElements()
    }
  }, [toast])

  return { exportPDF }
}
