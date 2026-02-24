import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { toPng } from "html-to-image"

export const useExportWeekPDF = () => {
  const { toast } = useToast()

  const exportPDF = useCallback(async (
    elementId: string, 
    filename: string,
    config?: { nombreEmpresa?: string; colorEmpresa?: string }
  ) => {
    const element = document.getElementById(elementId)
    if (!element) return

    try {
      // Usar el nuevo exportador profesional basado en clonación
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const clone = element.cloneNode(true) as HTMLElement

        const wrapper = document.createElement("div")
        wrapper.style.position = "fixed"
        wrapper.style.top = "-99999px"
        wrapper.style.left = "-99999px"
        wrapper.style.background = "#ffffff"
        wrapper.style.padding = "0"
        wrapper.style.margin = "0"
        wrapper.style.pointerEvents = "none"

        wrapper.appendChild(clone)
        document.body.appendChild(wrapper)

        const realWidth = element.scrollWidth
        clone.style.width = realWidth + "px"
        clone.style.maxWidth = realWidth + "px"
        clone.style.overflow = "visible"

        requestAnimationFrame(() => {
          toPng(clone, {
            cacheBust: true,
            pixelRatio: 2,
            backgroundColor: "#ffffff"
          }).then(resolve).catch(reject).finally(() => {
            document.body.removeChild(wrapper)
          })
        })
      })

      // Convertir a PDF
      const [jsPDF] = await Promise.all([
        import("jspdf").then(m => m.default),
      ])

      const pdf = new jsPDF()
      const img = new Image()
      img.src = dataUrl
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const imgWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (img.height / img.width) * imgWidth
      
      pdf.addImage(img, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(filename.replace('.png', '.pdf'))

      toast({
        title: "OK",
        description: "PDF exportado correctamente.",
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "Error",
        description: "No se pudo exportar el PDF.",
        variant: "destructive",
      })
    }
  }, [toast])

  return { exportPDF }
}
