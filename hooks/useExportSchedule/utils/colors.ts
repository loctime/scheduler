// Función helper para convertir hex a rgba
export const hexToRgba = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace("#", "").trim()
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16)
    const g = parseInt(cleanHex.substring(2, 4), 16)
    const b = parseInt(cleanHex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // Si el hex no es válido, devolver un color por defecto
  return `rgba(211, 211, 211, ${alpha})`
}

// Función helper para convertir color hex a RGB sin #
export const hexToRgb = (hex: string): string => {
  if (!hex) return "FFFFFF"
  const cleanHex = hex.replace("#", "").trim()
  if (cleanHex.length === 6) {
    return cleanHex.toUpperCase()
  }
  if (cleanHex.length === 3) {
    // Expandir formato corto #RGB a #RRGGBB
    return cleanHex.split("").map(c => c + c).join("").toUpperCase()
  }
  return "FFFFFF"
}

// Función helper para determinar color de texto según contraste
export const getTextColor = (bgColor: string): string => {
  const rgb = hexToRgb(bgColor)
  const r = parseInt(rgb.substring(0, 2), 16)
  const g = parseInt(rgb.substring(2, 4), 16)
  const b = parseInt(rgb.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "000000" : "FFFFFF"
}

// Función helper para suavizar colores (aumentar luminosidad ligeramente)
export const softenColor = (hex: string, factor: number = 0.15): string => {
  // Asegurarse de que el hex no tenga #
  const cleanHex = hex.replace("#", "").trim()
  const rgb = hexToRgb(cleanHex)
  const r = parseInt(rgb.substring(0, 2), 16)
  const g = parseInt(rgb.substring(2, 4), 16)
  const b = parseInt(rgb.substring(4, 6), 16)
  
  // Mezclar con blanco para suavizar (factor: 0 = color original, 1 = blanco)
  const newR = Math.round(r + (255 - r) * factor)
  const newG = Math.round(g + (255 - g) * factor)
  const newB = Math.round(b + (255 - b) * factor)
  
  return `${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`.toUpperCase()
}
