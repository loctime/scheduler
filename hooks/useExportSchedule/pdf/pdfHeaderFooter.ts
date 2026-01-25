import { format } from "date-fns"
import { es } from "date-fns/locale"

// Función para agregar header
export const addHeader = (
  pdf: any, 
  pageNum: number, 
  totalPages: number, 
  weekStartDate: Date, 
  weekEndDate: Date, 
  nombreEmpresa?: string
) => {
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const margin = 10

  pdf.setFontSize(16)
  pdf.setFont(undefined, "bold")
  
  // Título del mes/empresa
  if (nombreEmpresa) {
    pdf.text(nombreEmpresa, margin, 15)
  }
  
  // Fecha de la semana
  pdf.setFontSize(12)
  pdf.setFont(undefined, "normal")
  const weekText = `Semana del ${format(weekStartDate, "d", { locale: es })} - ${format(weekEndDate, "d 'de' MMMM yyyy", { locale: es })}`
  pdf.text(weekText, pdfWidth - margin - pdf.getTextWidth(weekText), 15)
}

// Función para agregar footer
export const addFooter = (pdf: any, pageNum: number, totalPages: number) => {
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const footerHeight = 20

  pdf.setFontSize(10)
  pdf.setFont(undefined, "normal")
  const footerText = `Página ${pageNum} de ${totalPages}`
  const footerWidth = pdf.getTextWidth(footerText)
  pdf.text(footerText, (pdfWidth - footerWidth) / 2, pdfHeight - 5)
  
  // Línea separadora
  pdf.setDrawColor(200, 200, 200)
  pdf.line(margin, pdfHeight - footerHeight + 5, pdfWidth - margin, pdfHeight - footerHeight + 5)
}
