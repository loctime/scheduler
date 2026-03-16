import { toPng } from "html-to-image"

export async function exportPedidoImage() {
  const node = document.getElementById("pedido-image")

  if (!node) {
    console.error("Element with id 'pedido-image' not found")
    return
  }

  try {
    const dataUrl = await toPng(node, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: "#ffffff"
    })

    const link = document.createElement("a")
    link.download = "pedido.png"
    link.href = dataUrl
    link.click()
  } catch (error) {
    console.error("Error exporting image:", error)
  }
}
