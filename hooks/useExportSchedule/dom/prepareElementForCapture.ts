import { addBottomSeparator } from "./separators"
import { cleanFlexDivs } from "./cleanFlexDivs"

export interface CaptureSnapshot {
  originalOverflow: {
    overflow: string
    overflowX: string
    overflowY: string
  }
  originalStyles: Map<HTMLElement, { padding: string; margin: string }>
  originalPadding: string
  bottomSeparatorRow: HTMLTableRowElement | null
  cleanedFlex: any[]
}

// Helper para preparar elemento para captura
export const prepareElementForCapture = (
  htmlElement: HTMLElement,
  config?: { nombreEmpresa?: string; colorEmpresa?: string }
): CaptureSnapshot => {
  const snapshot: CaptureSnapshot = {
    originalOverflow: {
      overflow: htmlElement.style.overflow,
      overflowX: htmlElement.style.overflowX,
      overflowY: htmlElement.style.overflowY,
    },
    originalStyles: new Map<HTMLElement, { padding: string; margin: string }>(),
    originalPadding: htmlElement.style.padding || getComputedStyle(htmlElement).padding,
    bottomSeparatorRow: null as HTMLTableRowElement | null,
    cleanedFlex: [],
  }

  // Eliminar padding y márgenes del elemento y sus hijos
  const removeSpacing = (el: HTMLElement) => {
    snapshot.originalStyles.set(el, {
      padding: el.style.padding || getComputedStyle(el).padding,
      margin: el.style.margin || getComputedStyle(el).margin,
    })
    el.style.padding = "0"
    el.style.margin = "0"
  }
  
  removeSpacing(htmlElement)
  htmlElement.querySelectorAll("*").forEach((el) => {
    if (el instanceof HTMLElement) {
      removeSpacing(el)
    }
  })

  htmlElement.style.overflow = "visible"
  htmlElement.style.overflowX = "visible"
  htmlElement.style.overflowY = "visible"

  snapshot.cleanedFlex = cleanFlexDivs(htmlElement)

  // Ajustar contenedores al ancho real de la tabla
  const table = htmlElement.querySelector("table")
  if (table) {
    // Agregar separador inferior antes de exportar
    if (config?.nombreEmpresa) {
      snapshot.bottomSeparatorRow = addBottomSeparator(table, config.nombreEmpresa, config.colorEmpresa)
    }

    const tableWidth = table.scrollWidth
    const containers = htmlElement.querySelectorAll(".overflow-x-auto, .overflow-hidden, [class*='Card'], [class*='card']")
    containers.forEach((container) => {
      if (container instanceof HTMLElement) {
        container.style.width = `${tableWidth}px`
        container.style.maxWidth = `${tableWidth}px`
      }
    })
    htmlElement.style.width = `${tableWidth}px`
    htmlElement.style.maxWidth = `${tableWidth}px`
  }

  // Agregar margen abajo y a la derecha antes de exportar
  const marginRight = 20
  const marginBottom = 20
  htmlElement.style.padding = `0 ${marginRight}px ${marginBottom}px 0`
  htmlElement.style.boxSizing = "content-box"

  return snapshot
}
