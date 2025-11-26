import { useCallback, useState } from "react"
import { useToast } from "@/hooks/use-toast"

export function useExportSchedule() {
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const exportImage = useCallback(async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId)
    if (!element) {
      toast({
        title: "Error",
        description: "No se encontró el elemento a exportar. Por favor, recarga la página.",
        variant: "destructive",
      })
      return
    }

    // Verificar que el elemento sea visible
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      toast({
        title: "Error",
        description: "El elemento no es visible. Por favor, asegúrate de que el horario esté cargado.",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: rect.width,
        height: rect.height,
      })
      
      if (!canvas) {
        throw new Error("No se pudo generar el canvas")
      }

      const link = document.createElement("a")
      link.download = filename
      link.href = canvas.toDataURL("image/png", 1.0)
      link.style.display = "none"
      document.body.appendChild(link)
      link.click()
      // Esperar un poco antes de remover el link para asegurar que la descarga se inicie
      setTimeout(() => {
        document.body.removeChild(link)
      }, 100)
      
      toast({
        title: "Imagen exportada",
        description: "El horario se ha exportado como imagen",
      })
    } catch (error: any) {
      console.error("Error al exportar imagen:", error)
      toast({
        title: "Error",
        description: error?.message || "Ocurrió un error al exportar la imagen. Verifica la consola para más detalles.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [toast])

  const exportPDF = useCallback(async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId)
    if (!element) {
      toast({
        title: "Error",
        description: "No se encontró el elemento a exportar. Por favor, recarga la página.",
        variant: "destructive",
      })
      return
    }

    // Verificar que el elemento sea visible
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      toast({
        title: "Error",
        description: "El elemento no es visible. Por favor, asegúrate de que el horario esté cargado.",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      const [html2canvas, jsPDF] = await Promise.all([
        import("html2canvas").then((m) => m.default),
        import("jspdf").then((m) => m.default),
      ])

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: rect.width,
        height: rect.height,
      })
      
      if (!canvas) {
        throw new Error("No se pudo generar el canvas")
      }

      const imgData = canvas.toDataURL("image/png", 1.0)
      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
      pdf.save(filename)
      toast({
        title: "PDF exportado",
        description: "El horario se ha exportado como PDF",
      })
    } catch (error: any) {
      console.error("Error al exportar PDF:", error)
      toast({
        title: "Error",
        description: error?.message || "Ocurrió un error al exportar el PDF. Verifica la consola para más detalles.",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }, [toast])

  return {
    exporting,
    exportImage,
    exportPDF,
  }
}

