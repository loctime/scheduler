import { toPng } from "html-to-image"

export const exportScheduleAsImage = async (
  element: HTMLElement,
  fileName: string = "horario.png"
) => {

  if (!element) return

  const clone = element.cloneNode(true) as HTMLElement

  const wrapper = document.createElement("div")
  wrapper.style.position = "fixed"
  wrapper.style.top = "-99999px"
  wrapper.style.left = "-99999px"
  wrapper.style.background = "#ffffff"
  wrapper.style.padding = "0"
  wrapper.style.margin = "0"
  wrapper.style.pointerEvents = "none"
  wrapper.style.width = "auto"
  wrapper.style.height = "auto"
  wrapper.style.overflow = "visible"

  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  // Asegurar que el clon tenga el mismo tamaño que el original
  const computedStyle = getComputedStyle(element)
  clone.style.width = element.scrollWidth + "px"
  clone.style.maxWidth = element.scrollWidth + "px"
  clone.style.height = element.scrollHeight + "px"
  clone.style.minHeight = element.scrollHeight + "px"
  clone.style.overflow = "visible"

  // Esperar más tiempo para asegurar renderizado completo
  await new Promise((resolve) => setTimeout(resolve, 100))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => setTimeout(resolve, 50))

  try {
    const dataUrl = await toPng(clone, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width: element.scrollWidth * 2,
      height: element.scrollHeight * 2,
      style: {
        transform: 'scale(2)',
        transformOrigin: 'top left'
      }
    })

    // Verificar que la imagen se generó correctamente
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('No se pudo generar la imagen')
    }

    document.body.removeChild(wrapper)

    const link = document.createElement("a")
    link.download = fileName
    link.href = dataUrl
    link.click()
  } catch (error) {
    console.error('Error al exportar imagen:', error)
    document.body.removeChild(wrapper)
    throw error
  }
}