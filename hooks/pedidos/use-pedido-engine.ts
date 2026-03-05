"use client"

import { useState, useMemo, useCallback } from "react"
import { buildPedidoOficial } from "@/lib/build-pedido-oficial"
import type { Pedido, Producto } from "@/lib/types"
import type { PedidoEngineOutput } from "@/lib/pedido-engine"

export function usePedidoEngine(
  selectedPedido: Pedido | null,
  products: Producto[],
  stockActual: Record<string, number>
) {
  const [ajustesPedido, setAjustesPedido] = useState<Record<string, number>>({})

  const resultadoEngine = useMemo((): PedidoEngineOutput | null => {
    if (!selectedPedido) return null

    return buildPedidoOficial({
      pedido: {
        nombre: selectedPedido.nombre,
        formatoSalida: selectedPedido.formatoSalida,
        mensajePrevio: selectedPedido.mensajePrevio
      },
      productos: products,
      stockActual,
      ajustesPedido,
      usarCantidadesManuales: false
    })
  }, [selectedPedido, products, stockActual, ajustesPedido])

  const productosAPedirActualizados = useMemo(() => {
    return resultadoEngine
      ? resultadoEngine.productosCalculados.map((producto) => ({
          id: producto.productoId,
          nombre: producto.nombre,
          stockMinimo: 0,
          cantidadUnidades: producto.cantidadUnidades
        }))
      : []
  }, [resultadoEngine])

  const handleAjustePedidoChange = useCallback((productId: string, ajuste: number) => {
    setAjustesPedido((prev) => {
      if (ajuste === 0) {
        const nuevo = { ...prev }
        delete nuevo[productId]
        return nuevo
      }
      return { ...prev, [productId]: ajuste }
    })
  }, [])

  return {
    resultadoEngine,
    productosAPedirActualizados,
    ajustesPedido,
    setAjustesPedido,
    handleAjustePedidoChange
  }
}
