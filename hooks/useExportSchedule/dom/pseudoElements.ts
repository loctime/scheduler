// Desactiva todos los pseudo-elementos que generan los "cuadritos"
export const disablePseudoElements = () => {
  document.body.classList.add("exporting-image")
}

export const enablePseudoElements = () => {
  document.body.classList.remove("exporting-image")
}
