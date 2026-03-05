"use client"

import { useState, useEffect, useCallback } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import type { Pedido } from "@/lib/types"
import type { PedidoEngineOutput } from "@/lib/pedido-engine"

export interface UsePedidoEnlacesParams {
  selectedPedido: Pedido | null
  ownerId: string | null
  user: { uid: string } | null
  resultadoEngine: PedidoEngineOutput | null
  createPedido: (nombre: string, stockMin: number, formato: string) => Promise<Pedido | null>
  setSelectedPedido: (p: Pedido | null) => void
  crearEnlacePublico: (pedidoId: string, cantidades?: Record<string, number>) => Promise<any>
  DEFAULT_FORMAT: string
  onNeedsConfirmacion?: () => void
}

export function usePedidoEnlaces(params: UsePedidoEnlacesParams) {
  const {
    selectedPedido,
    ownerId,
    user,
    resultadoEngine,
    createPedido,
    setSelectedPedido,
    crearEnlacePublico,
    DEFAULT_FORMAT,
    onNeedsConfirmacion
  } = params

  const { toast } = useToast()
  const [enlaceActivo, setEnlaceActivo] = useState<{ id: string } | null>(null)

  useEffect(() => {
    if (!selectedPedido?.id || !db || !user) {
      setEnlaceActivo(null)
      return
    }
    if (!ownerId) return

    const enlaceRef = selectedPedido.enlacePublicoId
      ? doc(db, COLLECTIONS.ENLACES_PUBLICOS, selectedPedido.enlacePublicoId)
      : null

    if (enlaceRef) {
      const unsubscribe = onSnapshot(
        enlaceRef,
        (snapshot: any) => {
          if (!snapshot.exists()) {
            setEnlaceActivo(null)
            return
          }
          const data = snapshot.data() as any
          setEnlaceActivo(data.activo ? { id: snapshot.id } : null)
        },
        (error: any) => {
          console.error("Error en listener de enlaces:", error)
        }
      )
      return () => unsubscribe()
    } else {
      setEnlaceActivo(null)
      return () => {}
    }
  }, [selectedPedido?.id, selectedPedido?.enlacePublicoId, db, user, ownerId])

  const verificarPedidoEnProceso = useCallback(() => {
    if (selectedPedido?.estado === "processing" && selectedPedido.assignedTo) {
      const assignedToNombre = selectedPedido.assignedToNombre || "otro usuario"
      toast({
        title: "Pedido en proceso",
        description: `Este pedido está siendo procesado por: ${assignedToNombre} - Fábrica. ¿Deseas crear un nuevo enlace?`,
        variant: "default"
      })
      return true
    }
    return false
  }, [selectedPedido, toast])

  const ejecutarGenerarEnlace = useCallback(async () => {
    let pedidoAUsar = selectedPedido
    if (!pedidoAUsar) {
      const nombrePedido = `Pedido ${new Date().toLocaleDateString("es-AR")}`
      const nuevoPedido = await createPedido(nombrePedido, 1, DEFAULT_FORMAT)
      if (!nuevoPedido) {
        toast({
          title: "Error",
          description: "No se pudo crear el pedido",
          variant: "destructive"
        })
        return
      }
      setSelectedPedido(nuevoPedido)
      pedidoAUsar = nuevoPedido
    }

    verificarPedidoEnProceso()

    try {
      if (!resultadoEngine) {
        toast({
          title: "Error",
          description: "No se pudo generar el pedido",
          variant: "destructive"
        })
        return
      }

      const nuevoEnlace = await crearEnlacePublico(pedidoAUsar.id, resultadoEngine.cantidadesPedidas)
      if (nuevoEnlace) {
        setEnlaceActivo({ id: nuevoEnlace.id })
        const url = `${typeof window !== "undefined" ? window.location.origin : ""}/pedido-publico/${nuevoEnlace.id}`
        const textoCompleto = `${resultadoEngine.texto}\n\n\n${url}`
        await navigator.clipboard.writeText(textoCompleto)
        toast({
          title: "Enlace generado y copiado",
          description: "El pedido y el enlace público se han copiado al portapapeles"
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo generar el enlace",
        variant: "destructive"
      })
    }
  }, [
    selectedPedido,
    createPedido,
    setSelectedPedido,
    resultadoEngine,
    crearEnlacePublico,
    DEFAULT_FORMAT,
    verificarPedidoEnProceso,
    toast
  ])

  const handleGenerarEnlace = useCallback(async () => {
    let pedidoAUsar = selectedPedido
    if (!pedidoAUsar) {
      const nombrePedido = `Pedido ${new Date().toLocaleDateString("es-AR")}`
      const nuevoPedido = await createPedido(nombrePedido, 1, DEFAULT_FORMAT)
      if (!nuevoPedido) {
        toast({
          title: "Error",
          description: "No se pudo crear el pedido",
          variant: "destructive"
        })
        return
      }
      setSelectedPedido(nuevoPedido)
      pedidoAUsar = nuevoPedido
    }

    if (pedidoAUsar.estado === "enviado") {
      toast({
        title: "No se puede generar enlace",
        description:
          "Este pedido está esperando recepción. Completa la recepción antes de generar un nuevo enlace.",
        variant: "destructive"
      })
      return
    }

    if (pedidoAUsar.estado === "recibido") {
      toast({
        title: "No se puede generar enlace",
        description:
          "Este pedido está en proceso de recepción. Completa la recepción antes de generar un nuevo enlace.",
        variant: "destructive"
      })
      return
    }

    if (enlaceActivo) {
      onNeedsConfirmacion?.()
      return
    }

    await ejecutarGenerarEnlace()
  }, [
    selectedPedido,
    enlaceActivo,
    createPedido,
    setSelectedPedido,
    DEFAULT_FORMAT,
    onNeedsConfirmacion,
    ejecutarGenerarEnlace,
    toast
  ])

  return {
    enlaceActivo,
    setEnlaceActivo,
    handleGenerarEnlace,
    ejecutarGenerarEnlace,
    verificarPedidoEnProceso
  }
}
