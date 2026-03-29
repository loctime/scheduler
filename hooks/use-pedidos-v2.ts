"use client"

import { useCallback, useMemo, useState } from "react"
import {
  pedidosV2UseCases,
  type CreatePedidoInput,
  type EmitirRemitoSalidaInput,
  type RegistrarTransporteInput,
  type ConfirmarRecepcionInput
} from "@/src/modules/pedidos-v2/application/use-cases"

export function usePedidosV2() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T>(fn: () => Promise<T>) => {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (err: any) {
      const message = err?.message || "Operacion no disponible"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createPedido = useCallback((input: CreatePedidoInput) => run(() => pedidosV2UseCases.createPedido(input)), [run])
  const emitirRemitoSalida = useCallback((input: EmitirRemitoSalidaInput) => run(() => pedidosV2UseCases.emitirRemitoSalida(input)), [run])
  const registrarTransporte = useCallback((input: RegistrarTransporteInput) => run(() => pedidosV2UseCases.registrarTransporte(input.remitoSalidaId, input.pedidoId, input.firmaTransportista, input.items)), [run])
  const confirmarRecepcion = useCallback((input: ConfirmarRecepcionInput) => run(() => pedidosV2UseCases.confirmarRecepcion(input)), [run])

  return useMemo(() => ({
    loading,
    error,
    createPedido,
    emitirRemitoSalida,
    registrarTransporte,
    confirmarRecepcion
  }), [loading, error, createPedido, emitirRemitoSalida, registrarTransporte, confirmarRecepcion])
}
