export const cleanFlexDivs = (element: HTMLElement) => {
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
