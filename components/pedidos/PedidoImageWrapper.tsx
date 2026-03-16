"use client"

import { PedidoImageTemplate } from "./PedidoImageTemplate"
import { exportPedidoImage } from "@/lib/exportPedidoImage"

interface PedidoItem {
  nombre: string
  cantidad: number
}

interface PedidoImageWrapperProps {
  local: string
  responsable: string
  fecha: string
  titulo?: string
  items: PedidoItem[]
  children?: React.ReactNode
}

export function PedidoImageWrapper({
  local,
  responsable,
  fecha,
  titulo = "PEDIDO INSUMOS PAPELERA",
  items,
  children
}: PedidoImageWrapperProps) {
  const handleExportImage = () => {
    // Render the template temporarily for export
    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'absolute'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    document.body.appendChild(tempContainer)

    // Create a React root and render the template
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(tempContainer)
      
      const templateElement = (
        <PedidoImageTemplate
          local={local}
          responsable={responsable}
          fecha={fecha}
          titulo={titulo}
          items={items}
        />
      )
      
      root.render(templateElement)
      
      // Wait a moment for rendering to complete
      setTimeout(() => {
        // Find the rendered element
        const pedidoImageElement = tempContainer.querySelector('#pedido-image')
        if (pedidoImageElement) {
          // Use html-to-image to export
          import('html-to-image').then(({ toPng }) => {
            toPng(pedidoImageElement as HTMLElement, {
              quality: 1.0,
              pixelRatio: 2,
              backgroundColor: "#ffffff"
            }).then((dataUrl) => {
              const link = document.createElement('a')
              link.download = 'pedido.png'
              link.href = dataUrl
              link.click()
            }).catch(console.error)
          })
        }
        
        // Clean up
        root.unmount()
        document.body.removeChild(tempContainer)
      }, 100)
    })
  }

  return (
    <>
      {children}
    </>
  )
}
