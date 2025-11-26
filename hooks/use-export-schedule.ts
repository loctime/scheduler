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
    const htmlElement = element as HTMLElement
    try {
      // Guardar estilos originales para restaurarlos después
      const originalOverflow = htmlElement.style.overflow
      const originalOverflowX = htmlElement.style.overflowX
      const originalOverflowY = htmlElement.style.overflowY
      
      // Remover overflow temporalmente para capturar todo el contenido
      htmlElement.style.overflow = "visible"
      htmlElement.style.overflowX = "visible"
      htmlElement.style.overflowY = "visible"
      
      // También remover overflow de elementos hijos con scroll
      const scrollableChildren: Array<{ el: HTMLElement; overflow: string; overflowX: string; overflowY: string }> = []
      const allChildren = element.querySelectorAll("*")
      allChildren.forEach((child) => {
        const htmlChild = child as HTMLElement
        if (htmlChild && htmlChild.style) {
          const computedStyle = window.getComputedStyle(htmlChild)
          if (computedStyle.overflow !== "visible" || computedStyle.overflowX !== "visible" || computedStyle.overflowY !== "visible") {
            scrollableChildren.push({
              el: htmlChild,
              overflow: htmlChild.style.overflow || "",
              overflowX: htmlChild.style.overflowX || "",
              overflowY: htmlChild.style.overflowY || "",
            })
            htmlChild.style.overflow = "visible"
            htmlChild.style.overflowX = "visible"
            htmlChild.style.overflowY = "visible"
          }
        }
      })
      
      try {
        // Usar dom-to-image-more que maneja mejor los colores modernos
        const domtoimage = await import("dom-to-image-more")
        
        // Convertir badges a texto simple para la exportación
        const badges = element.querySelectorAll("[data-slot='badge']")
        const originalContent: Array<{ el: HTMLElement; originalHTML: string; originalStyle: string }> = []
        badges.forEach((badge) => {
          const htmlBadge = badge as HTMLElement
          originalContent.push({
            el: htmlBadge,
            originalHTML: htmlBadge.innerHTML,
            originalStyle: htmlBadge.getAttribute("style") || "",
          })
          // Obtener solo el texto del badge
          const textContent = htmlBadge.textContent || htmlBadge.innerText || ""
          htmlBadge.innerHTML = textContent
          htmlBadge.style.backgroundColor = "transparent"
          htmlBadge.style.border = "none"
          htmlBadge.style.borderRadius = "0"
          htmlBadge.style.padding = "0"
          htmlBadge.style.color = "inherit"
          htmlBadge.style.fontSize = "inherit"
          htmlBadge.style.fontWeight = "inherit"
        })
        
        try {
          // Usar scrollWidth y scrollHeight para capturar todo el contenido
          const width = element.scrollWidth || rect.width
          const height = element.scrollHeight || rect.height
          
          const dataUrl = await domtoimage.toPng(element, {
            quality: 1.0,
            bgcolor: "#ffffff",
            width: width,
            height: height,
          })
          
          const link = document.createElement("a")
          link.download = filename
          link.href = dataUrl
          link.style.display = "none"
          document.body.appendChild(link)
          link.click()
          setTimeout(() => {
            document.body.removeChild(link)
          }, 100)
          
          toast({
            title: "Imagen exportada",
            description: "El horario se ha exportado como imagen",
          })
        } finally {
          // Restaurar contenido original de los badges
          originalContent.forEach(({ el, originalHTML, originalStyle }) => {
            el.innerHTML = originalHTML
            if (originalStyle) {
              el.setAttribute("style", originalStyle)
            } else {
              el.removeAttribute("style")
            }
          })
        }
        
      } finally {
        // Restaurar estilos originales
        htmlElement.style.overflow = originalOverflow
        htmlElement.style.overflowX = originalOverflowX
        htmlElement.style.overflowY = originalOverflowY
        
        scrollableChildren.forEach(({ el, overflow, overflowX, overflowY }) => {
          el.style.overflow = overflow
          el.style.overflowX = overflowX
          el.style.overflowY = overflowY
        })
      }

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
    const htmlElement = element as HTMLElement
    try {
      // Guardar estilos originales para restaurarlos después
      const originalOverflow = htmlElement.style.overflow
      const originalOverflowX = htmlElement.style.overflowX
      const originalOverflowY = htmlElement.style.overflowY
      
      // Remover overflow temporalmente para capturar todo el contenido
      htmlElement.style.overflow = "visible"
      htmlElement.style.overflowX = "visible"
      htmlElement.style.overflowY = "visible"
      
      // También remover overflow de elementos hijos con scroll
      const scrollableChildren: Array<{ el: HTMLElement; overflow: string; overflowX: string; overflowY: string }> = []
      const allChildren = element.querySelectorAll("*")
      allChildren.forEach((child) => {
        const htmlChild = child as HTMLElement
        if (htmlChild && htmlChild.style) {
          const computedStyle = window.getComputedStyle(htmlChild)
          if (computedStyle.overflow !== "visible" || computedStyle.overflowX !== "visible" || computedStyle.overflowY !== "visible") {
            scrollableChildren.push({
              el: htmlChild,
              overflow: htmlChild.style.overflow || "",
              overflowX: htmlChild.style.overflowX || "",
              overflowY: htmlChild.style.overflowY || "",
            })
            htmlChild.style.overflow = "visible"
            htmlChild.style.overflowX = "visible"
            htmlChild.style.overflowY = "visible"
          }
        }
      })
      
      try {
        const [domtoimage, jsPDF] = await Promise.all([
          import("dom-to-image-more"),
          import("jspdf").then((m) => m.default),
        ])

        // Convertir badges a texto simple para la exportación
        const badges = element.querySelectorAll("[data-slot='badge']")
        const originalContent: Array<{ el: HTMLElement; originalHTML: string; originalStyle: string }> = []
        badges.forEach((badge) => {
          const htmlBadge = badge as HTMLElement
          originalContent.push({
            el: htmlBadge,
            originalHTML: htmlBadge.innerHTML,
            originalStyle: htmlBadge.getAttribute("style") || "",
          })
          // Obtener solo el texto del badge
          const textContent = htmlBadge.textContent || htmlBadge.innerText || ""
          htmlBadge.innerHTML = textContent
          htmlBadge.style.backgroundColor = "transparent"
          htmlBadge.style.border = "none"
          htmlBadge.style.borderRadius = "0"
          htmlBadge.style.padding = "0"
          htmlBadge.style.color = "inherit"
          htmlBadge.style.fontSize = "inherit"
          htmlBadge.style.fontWeight = "inherit"
        })
        
        try {
          // Usar scrollWidth y scrollHeight para capturar todo el contenido
          const width = element.scrollWidth || rect.width
          const height = element.scrollHeight || rect.height

          // Usar dom-to-image-more para generar la imagen
          const dataUrl = await domtoimage.toPng(element, {
            quality: 1.0,
            bgcolor: "#ffffff",
            width: width,
            height: height,
          })

          const pdf = new jsPDF("l", "mm", "a4")
          const pdfWidth = pdf.internal.pageSize.getWidth()
          
          // Crear una imagen para obtener las dimensiones
          const img = new Image()
          img.src = dataUrl
          await new Promise((resolve) => {
            img.onload = resolve
          })
          
          const pdfHeight = (img.height * pdfWidth) / img.width
          pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight)
          pdf.save(filename)
          
          toast({
            title: "PDF exportado",
            description: "El horario se ha exportado como PDF",
          })
        } finally {
          // Restaurar contenido original de los badges
          originalContent.forEach(({ el, originalHTML, originalStyle }) => {
            el.innerHTML = originalHTML
            if (originalStyle) {
              el.setAttribute("style", originalStyle)
            } else {
              el.removeAttribute("style")
            }
          })
        }
      } finally {
        // Restaurar estilos originales
        htmlElement.style.overflow = originalOverflow
        htmlElement.style.overflowX = originalOverflowX
        htmlElement.style.overflowY = originalOverflowY
        
        scrollableChildren.forEach(({ el, overflow, overflowX, overflowY }) => {
          el.style.overflow = overflow
          el.style.overflowX = overflowX
          el.style.overflowY = overflowY
        })
      }
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

