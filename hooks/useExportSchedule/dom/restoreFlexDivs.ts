export const restoreFlexDivs = (cleaned: any[]) => {
  cleaned.forEach(({ el, background, border, boxShadow, display, padding }) => {
    el.style.background = background
    el.style.border = border
    el.style.boxShadow = boxShadow
    el.style.display = display
    el.style.padding = padding || ""
  })
}
