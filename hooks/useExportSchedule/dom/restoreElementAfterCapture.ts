import type { CaptureSnapshot } from "./prepareElementForCapture"

// Helper para restaurar elemento después de captura
export const restoreElementAfterCapture = (htmlElement: HTMLElement, snapshot: CaptureSnapshot, restoreFlexDivs: (cleaned: any[]) => void) => {
  // Restaurar padding original
  htmlElement.style.padding = snapshot.originalPadding

  // Remover separador inferior después de exportar
  if (snapshot.bottomSeparatorRow && snapshot.bottomSeparatorRow.parentNode) {
    snapshot.bottomSeparatorRow.parentNode.removeChild(snapshot.bottomSeparatorRow)
  }

  restoreFlexDivs(snapshot.cleanedFlex)

  // Restaurar estilos originales
  snapshot.originalStyles.forEach((styles, el) => {
    el.style.padding = styles.padding
    el.style.margin = styles.margin
  })

  htmlElement.style.overflow = snapshot.originalOverflow.overflow
  htmlElement.style.overflowX = snapshot.originalOverflow.overflowX
  htmlElement.style.overflowY = snapshot.originalOverflow.overflowY
}
