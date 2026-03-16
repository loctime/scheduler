"use client"

import { useCallback } from 'react'

interface PedidoItem {
  nombre: string
  cantidad: number
}

interface PedidoData {
  local: string
  responsable: string
  fecha: string
  titulo?: string
  items: PedidoItem[]
}

export function usePedidoImageExport() {
  const exportPedidoImage = useCallback((pedidoData: PedidoData) => {
    // Create a temporary container
    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'absolute'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '700px'
    tempContainer.style.background = '#ffffff'
    tempContainer.style.fontFamily = 'Arial'
    tempContainer.style.border = '1px solid #ccc'
    document.body.appendChild(tempContainer)

    // Build the HTML structure directly
    const htmlContent = `
      <div id="pedido-image" style="width: 700px; background: #ffffff; font-family: Arial; border: 1px solid #ccc;">
        <div style="display: grid; grid-template-columns: 1fr 200px;">
          <div style="background: #d8d2e5; padding: 12px; font-weight: bold; text-align: center;">
            ${pedidoData.titulo || 'PEDIDO INSUMOS PAPELERA'}
          </div>
          <div style="border-left: 1px solid #ccc;">
            <div style="text-align: center; font-weight: bold;">FECHA</div>
            <div style="text-align: center;">${pedidoData.fecha}</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 200px;">
          <div style="background: #e4cfd3; padding: 12px; font-weight: bold; text-align: center;">
            LOCAL: ${pedidoData.local}
          </div>
          <div style="border-left: 1px solid #ccc;">
            <div style="text-align: center; font-weight: bold;">RESPONSABLE</div>
            <div style="text-align: center;">${pedidoData.responsable}</div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 120px; background: #ead28a; font-weight: bold; text-align: center; padding: 8px;">
          <div>INSUMO</div>
          <div>CANTIDAD</div>
        </div>
        ${pedidoData.items.map(item => `
          <div style="display: grid; grid-template-columns: 1fr 120px; padding: 6px 8px; border-top: 1px solid #ddd; align-items: center;">
            <div style="text-align: center;">${item.nombre}</div>
            <div style="text-align: center; font-weight: bold;">${item.cantidad}</div>
          </div>
        `).join('')}
      </div>
    `

    tempContainer.innerHTML = htmlContent

    // Export using html-to-image
    import('html-to-image').then(({ toPng }) => {
      const pedidoImageElement = tempContainer.querySelector('#pedido-image') as HTMLElement
      
      if (pedidoImageElement) {
        toPng(pedidoImageElement, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: "#ffffff"
        }).then((dataUrl) => {
          const link = document.createElement('a')
          link.download = 'pedido.png'
          link.href = dataUrl
          link.click()
        }).catch(console.error)
      }

      // Clean up
      setTimeout(() => {
        document.body.removeChild(tempContainer)
      }, 100)
    }).catch(console.error)
  }, [])

  return { exportPedidoImage }
}
