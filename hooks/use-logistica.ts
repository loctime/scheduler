"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { useSettings } from "@/hooks/use-settings"
import type { PedidoFabrica, PedidoFabricaItem, RemitoLog } from "@/lib/logistica-types"
import {
  actualizarItemsPedido as actualizarItemsPedidoSvc,
  confirmarRecepcion as confirmarRecepcionSvc,
  crearPedidoFabrica as crearPedidoFabricaSvc,
  crearRemito as crearRemitoSvc,
  marcarEnCamino as marcarEnCaminoSvc,
  tomarPedido as tomarPedidoSvc,
} from "@/lib/logistica-service"
import type { PermissionUser } from "@/lib/permissions"

function docToPedidoFabrica(id: string, data: Record<string, unknown>): PedidoFabrica {
  return {
    id,
    ownerId: String(data.ownerId ?? ""),
    origenLocationId: String(data.origenLocationId ?? ""),
    origenNombre: String(data.origenNombre ?? ""),
    destinoLocationId: String(data.destinoLocationId ?? ""),
    destinoNombre: String(data.destinoNombre ?? ""),
    grupoPedidoId: String(data.grupoPedidoId ?? ""),
    grupoPedidoNombre: String(data.grupoPedidoNombre ?? ""),
    estado: data.estado as PedidoFabrica["estado"],
    esPendiente: Boolean(data.esPendiente),
    controlado: data.controlado === true,
    pedidoOrigenId: data.pedidoOrigenId ? String(data.pedidoOrigenId) : undefined,
    items: (data.items as PedidoFabrica["items"]) ?? [],
    observacion: data.observacion ? String(data.observacion) : undefined,
    creadoEn: data.creadoEn,
    creadoPor: String(data.creadoPor ?? ""),
    creadoPorEmail: String(data.creadoPorEmail ?? ""),
    actualizadoEn: data.actualizadoEn,
  }
}

function docToRemitoLog(id: string, data: Record<string, unknown>): RemitoLog {
  return {
    id,
    ownerId: String(data.ownerId ?? ""),
    numero: String(data.numero ?? ""),
    origenLocationId: String(data.origenLocationId ?? ""),
    origenNombre: String(data.origenNombre ?? ""),
    destinoLocationId: String(data.destinoLocationId ?? ""),
    destinoNombre: String(data.destinoNombre ?? ""),
    pedidoFabricaId: data.pedidoFabricaId ? String(data.pedidoFabricaId) : undefined,
    estado: data.estado as RemitoLog["estado"],
    items: (data.items as RemitoLog["items"]) ?? [],
    observacion: data.observacion ? String(data.observacion) : undefined,
    creadoEn: data.creadoEn,
    creadoPor: String(data.creadoPor ?? ""),
    creadoPorEmail: String(data.creadoPorEmail ?? ""),
    actualizadoEn: data.actualizadoEn,
    stockDescontadoEn: data.stockDescontadoEn,
  }
}

export function useLogistica(user: { uid?: string; email?: string | null } | null) {
  const { userData } = useData()
  const { settings } = useSettings()
  const [pedidosRaw, setPedidosRaw] = useState<PedidoFabrica[]>([])
  const [remitosRaw, setRemitosRaw] = useState<RemitoLog[]>([])
  const [loading, setLoading] = useState(true)

  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const isAdmin = userData?.role === "admin"
  const locationId = userData?.locationId ?? null

  const actor: PermissionUser & { email?: string } = useMemo(
    () => ({
      uid: user?.uid,
      role: userData?.role,
      locationId: userData?.locationId ?? null,
      email: user?.email ?? undefined,
    }),
    [user?.uid, user?.email, userData?.role, userData?.locationId]
  )

  useEffect(() => {
    if (!db || !ownerId || !user?.uid) {
      setPedidosRaw([])
      setRemitosRaw([])
      setLoading(false)
      return
    }

    setLoading(true)
    const pedidosQ = query(
      collection(db, COLLECTIONS.PEDIDOS_FABRICA),
      where("ownerId", "==", ownerId)
    )
    const remitosQ = query(collection(db, COLLECTIONS.REMITOS_LOG), where("ownerId", "==", ownerId))

    const unsubPedidos = onSnapshot(
      pedidosQ,
      (snap) => {
        setPedidosRaw(snap.docs.map((d) => docToPedidoFabrica(d.id, d.data() as Record<string, unknown>)))
        setLoading(false)
      },
      () => {
        setPedidosRaw([])
        setLoading(false)
      }
    )

    const unsubRemitos = onSnapshot(
      remitosQ,
      (snap) => {
        setRemitosRaw(snap.docs.map((d) => docToRemitoLog(d.id, d.data() as Record<string, unknown>)))
        setLoading(false)
      },
      () => {
        setRemitosRaw([])
        setLoading(false)
      }
    )

    return () => {
      unsubPedidos()
      unsubRemitos()
    }
  }, [ownerId, user?.uid])

  const pedidosPropios = useMemo(() => {
    if (isAdmin) return pedidosRaw
    if (!locationId) return []
    return pedidosRaw.filter((p) => p.origenLocationId === locationId)
  }, [pedidosRaw, isAdmin, locationId])

  const pedidosParaMi = useMemo(() => {
    if (isAdmin) {
      return pedidosRaw.filter((p) => p.estado !== "recibido")
    }
    if (!locationId) return []
    return pedidosRaw.filter((p) => p.destinoLocationId === locationId && p.estado !== "recibido")
  }, [pedidosRaw, isAdmin, locationId])

  const remitosEnviados = useMemo(() => {
    if (isAdmin) return remitosRaw
    if (!locationId) return []
    return remitosRaw.filter((r) => r.origenLocationId === locationId)
  }, [remitosRaw, isAdmin, locationId])

  const remitosRecibidos = useMemo(() => {
    if (isAdmin) return remitosRaw
    if (!locationId) return []
    return remitosRaw.filter((r) => r.destinoLocationId === locationId)
  }, [remitosRaw, isAdmin, locationId])

  const crearPedidoFabrica = useCallback(
    async (
      input: Omit<Parameters<typeof crearPedidoFabricaSvc>[0], "ownerId" | "user">
    ) => {
      if (!ownerId) return { ok: false as const, error: "No se pudo determinar el espacio de trabajo" }
      return crearPedidoFabricaSvc({ ...input, ownerId, user: actor })
    },
    [ownerId, actor]
  )

  const crearRemito = useCallback(
    async (input: Omit<Parameters<typeof crearRemitoSvc>[0], "ownerId" | "user">) => {
      if (!ownerId) return { ok: false as const, error: "No se pudo determinar el espacio de trabajo" }
      return crearRemitoSvc({ ...input, ownerId, user: actor })
    },
    [ownerId, actor]
  )

  const confirmarRecepcion = useCallback(
    async (input: Omit<Parameters<typeof confirmarRecepcionSvc>[0], "ownerId" | "user" | "crearPedidoAutomaticoPorFaltante">) => {
      if (!ownerId) return { ok: false as const, error: "No se pudo determinar el espacio de trabajo" }
      return confirmarRecepcionSvc({ 
        ...input, 
        ownerId, 
        user: actor,
        crearPedidoAutomaticoPorFaltante: settings?.crearPedidoAutomaticoPorFaltante ?? true // Por defecto true (comportamiento actual)
      })
    },
    [ownerId, actor, settings?.crearPedidoAutomaticoPorFaltante]
  )

  const marcarEnCamino = useCallback(
    async (remitoId: string) => {
      if (!ownerId) return { ok: false as const, error: "No se pudo determinar el espacio de trabajo" }
      return marcarEnCaminoSvc({ remitoId, ownerId, user: actor })
    },
    [ownerId, actor]
  )

  const tomarPedido = useCallback(
    async (pedidoId: string) => {
      if (!ownerId) return { ok: false as const, error: "Sin espacio de trabajo" }
      return tomarPedidoSvc({ pedidoId, ownerId, user: actor })
    },
    [ownerId, actor]
  )

  const actualizarItemsPedido = useCallback(
    async (pedidoId: string, items: PedidoFabricaItem[]) => {
      if (!ownerId) return { ok: false as const, error: "Sin espacio de trabajo" }
      return actualizarItemsPedidoSvc({ pedidoId, ownerId, items, user: actor })
    },
    [ownerId, actor]
  )

  return {
    pedidosPropios,
    pedidosParaMi,
    remitosEnviados,
    remitosRecibidos,
    pedidosRaw,
    remitosRaw,
    crearPedidoFabrica,
    crearRemito,
    confirmarRecepcion,
    marcarEnCamino,
    tomarPedido,
    actualizarItemsPedido,
    loading,
    ownerId,
    isAdmin,
    locationId,
  }
}
