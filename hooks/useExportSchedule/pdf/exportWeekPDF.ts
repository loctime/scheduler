import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { prepareElementForCapture } from "../dom/prepareElementForCapture"
import { restoreElementAfterCapture } from "../dom/restoreElementAfterCapture"
import { disablePseudoElements, enablePseudoElements } from "../dom/pseudoElements"

export const useExportWeekPDF = () => {
  const { toast } = useToast()

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
      
      const snapshot = prepareElementForCapture(htmlElement, config)

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

      restoreElementAfterCapture(htmlElement, snapshot)

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
