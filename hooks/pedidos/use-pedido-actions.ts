"use client"

import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import type { Producto } from "@/lib/types"
import type { PedidoEngineOutput } from "@/lib/pedido-engine"
import { buildPedidoOficial } from "@/lib/build-pedido-oficial"
import { esModoPack, unitsToPacks } from "@/lib/unidades-utils"

export interface UsePedidoActionsParams {
  selectedPedido: { 
    sheetUrl?: string | null; 
    formatoSalida?: string; 
    nombre?: string; 
    mensajePrevio?: string 
  } | null
  products: Producto[]
  productosAPedirActualizados: Array<{ id: string; nombre: string; stockMinimo: number; cantidadUnidades: number }>
  resultadoEngine: PedidoEngineOutput | null
  stockActual: Record<string, number>
}

export function usePedidoActions(params: UsePedidoActionsParams) {
  const { selectedPedido, products, productosAPedirActualizados, resultadoEngine, stockActual } = params
  const { toast } = useToast()

  const handleCopyStock = useCallback(async () => {
    if (!selectedPedido) {
      toast({ title: "Error", description: "No hay pedido seleccionado", variant: "destructive" })
      return
    }

    if (products.length === 0) {
      toast({ title: "Sin productos", description: "No hay productos para copiar" })
      return
    }

    try {
      // Debug: mostrar datos actuales
      console.log("handleCopyStock - selectedPedido:", selectedPedido)
      console.log("handleCopyStock - products count:", products.length)
      console.log("handleCopyStock - stockActual:", stockActual)
      
      // Generar texto del stock actual usando el formato configurado
      const formatoSalida = selectedPedido.formatoSalida || "{nombre}: {cantidad} {unidad}"
      console.log("handleCopyStock - formatoSalida:", formatoSalida)
      
      const lineas = products
        .map((producto) => {
          const stockActualUnits = Math.max(0, Math.floor(stockActual[producto.id] ?? 0))
          
          // NO filtrar productos con stock 0 - mostrar todos para stock actual
          // if (stockActualUnits <= 0) {
          //   return null // No incluir productos con stock 0
          // }

          const unidad = producto.unidadBase || producto.unidad || "U"
          const cantidadPacks = esModoPack(producto)
            ? unitsToPacks(stockActualUnits, producto.cantidadPorPack ?? 1)
            : stockActualUnits

          let texto = formatoSalida
          const tienePlaceholders = texto.includes('{') && texto.includes('}')
          
          texto = texto.replace(/{nombre}/g, producto.nombre)
          texto = texto.replace(/{cantidad}/g, stockActualUnits.toString())
          texto = texto.replace(/{cantidadUnidades}/g, stockActualUnits.toString())
          texto = texto.replace(/{cantidadPacks}/g, cantidadPacks.toString())
          texto = texto.replace(/{unidad}/g, unidad)

          // Si el formato original no tenía placeholders, usar formato inteligente
          if (!tienePlaceholders) {
            if (esModoPack(producto)) {
              texto = `${producto.nombre}: ${cantidadPacks} pack${cantidadPacks !== 1 ? 's' : ''} ${unidad}`
            } else {
              texto = `${producto.nombre}: ${stockActualUnits} ${unidad}`
            }
          }

          return texto.trim()
        })
        .filter(Boolean) // Remover nulls

      console.log("handleCopyStock - lineas generadas:", lineas)

      // NO verificar si lineas está vacío - mostrar siempre todos los productos
      // if (lineas.length === 0) {
      //   toast({ title: "Stock vacío", description: "No hay productos con stock" })
      //   return
      // }

      const encabezado = `[Stock] ${selectedPedido.nombre || "Actual"}`
      const texto = `${encabezado}\n\n${lineas.join("\n")}\n\nTotal: ${lineas.length} productos`

      console.log("handleCopyStock - texto final:", texto)

      await navigator.clipboard.writeText(texto)
      toast({ title: "Stock copiado", description: "Stock actual copiado al portapapeles" })
    } catch (error) {
      console.error("Error al copiar stock:", error)
      toast({ title: "Error", description: "No se pudo copiar el stock", variant: "destructive" })
    }
  }, [selectedPedido, products, stockActual, toast])

  const handleCopyPedido = useCallback(async () => {
    if (productosAPedirActualizados.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }
    if (!resultadoEngine) {
      toast({ title: "Error", description: "No se pudo generar el pedido", variant: "destructive" })
      return
    }
    try {
      await navigator.clipboard.writeText(resultadoEngine.texto)
      toast({ title: "Copiado", description: "Pedido copiado al portapapeles" })
    } catch {
      toast({ title: "Error", description: "No se pudo copiar", variant: "destructive" })
    }
  }, [productosAPedirActualizados.length, resultadoEngine, toast])

  const handleLlevarPedidoASheet = useCallback(async () => {
    if (!selectedPedido?.sheetUrl) {
      toast({
        title: "Error",
        description: "No hay link de Google Sheet configurado",
        variant: "destructive"
      })
      return
    }

    if (products.length === 0) {
      toast({ title: "Sin productos", description: "No hay productos para copiar" })
      return
    }

    try {
      if (!resultadoEngine) {
        toast({
          title: "Error",
          description: "No se pudo generar el pedido",
          variant: "destructive"
        })
        return
      }

      const cantidadesMap = new Map(
        resultadoEngine.productosCalculados.map((p) => [p.productoId, p.cantidadUnidades])
      )
      const cantidadesPedir = products.map((p: Producto) => {
        const cantidad = cantidadesMap.get(p.id) || 0
        return cantidad.toString()
      })
      const textoACopiar = cantidadesPedir.join("\n")
      await navigator.clipboard.writeText(textoACopiar)
      window.open(selectedPedido.sheetUrl, "_blank")
      toast({
        title: "Copiado y abierto",
        description: "Las cantidades se copiaron al portapapeles y se abrió el Google Sheet"
      })
    } catch (error) {
      console.error("Error al llevar pedido a Sheet:", error)
      toast({
        title: "Error",
        description: "No se pudo copiar o abrir el Sheet",
        variant: "destructive"
      })
    }
  }, [selectedPedido?.sheetUrl, products, resultadoEngine, toast])

  const handleWhatsApp = useCallback(() => {
    if (productosAPedirActualizados.length === 0) {
      toast({ title: "Sin pedidos", description: "No hay productos que pedir" })
      return
    }
    if (!resultadoEngine) {
      toast({ title: "Error", description: "No se pudo generar el pedido", variant: "destructive" })
      return
    }
    const encoded = encodeURIComponent(resultadoEngine.texto)
    window.open(`https://wa.me/?text=${encoded}`, "_blank")
  }, [productosAPedirActualizados.length, resultadoEngine, toast])

  return {
    handleCopyPedido,
    handleCopyStock,
    handleLlevarPedidoASheet,
    handleWhatsApp
  }
}
