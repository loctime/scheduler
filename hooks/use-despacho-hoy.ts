"use client"

import { useEffect, useMemo, useState } from "react"
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore"
import type { User } from "firebase/auth"
import { useData } from "@/contexts/data-context"
import { useLogistica } from "@/hooks/use-logistica"
import { useGruposCatalogo } from "@/hooks/use-grupos-catalogo"
import { useUbicacionesCatalogo } from "@/hooks/use-ubicaciones-catalogo"
import { useToast } from "@/hooks/use-toast"
import { db, COLLECTIONS } from "@/lib/firebase"
import { buildAutoPedidosPorOperador } from "@/lib/logistica-utils"
import type { PedidoFabrica } from "@/lib/logistica-types"
import type { StockUbicacion } from "@/lib/stock-ubicaciones-types"

const HOY = new Date().getDay()

export function useDespachoHoy(user: User | null) {
  const { userData } = useData()
  const { toast } = useToast()
  const { pedidosRaw, remitosRaw, crearRemito, tomarPedido, marcarEnCamino, loading, ownerId } = useLogistica(user)
  const { gruposCatalogo } = useGruposCatalogo(ownerId)

  const ownerIdsParaUsuarios = useMemo(() => (ownerId ? [ownerId] : null), [ownerId])
  const { ubicaciones } = useUbicacionesCatalogo(ownerIdsParaUsuarios)

  const nombrePorLocationId = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of ubicaciones) m.set(u.locationId, u.locationName)
    return m
  }, [ubicaciones])

  const despachadorLocationId = userData?.locationId ?? ""

  const gruposVisibles = useMemo(() => {
    if (!despachadorLocationId) return []
    return gruposCatalogo.filter(
      (g) =>
        g.despachadores.some((d) => d.locationId === despachadorLocationId) &&
        (g.diasEnvio?.includes(HOY) ?? false)
    )
  }, [gruposCatalogo, despachadorLocationId])

  const gruposVisiblesIds = useMemo(() => gruposVisibles.map((g) => g.id), [gruposVisibles])
  const idsKey = gruposVisiblesIds.join(",")

  const [stockFilas, setStockFilas] = useState<StockUbicacion[]>([])

  useEffect(() => {
    if (!db || !ownerId || gruposVisiblesIds.length === 0) {
      setStockFilas([])
      return
    }
    const q = query(
      collection(db, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", ownerId),
      where("grupoCatalogoId", "in", gruposVisiblesIds)
    )
    const unsub = onSnapshot(q, (snap) => {
      setStockFilas(
        snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>
          return {
            id: d.id,
            ownerId: String(x.ownerId ?? ""),
            catalogoId: String(x.catalogoId ?? ""),
            locationId: String(x.locationId ?? ""),
            nombre: String(x.nombre ?? ""),
            unidad: String(x.unidad ?? "U"),
            pedidoId: String(x.pedidoId ?? ""),
            stockActual: Math.max(0, Math.floor(Number(x.stockActual) || 0)),
            stockMinimo: typeof x.stockMinimo === "number" ? x.stockMinimo : 0,
            orden: typeof x.orden === "number" ? x.orden : 0,
            grupoCatalogoId: typeof x.grupoCatalogoId === "string" ? x.grupoCatalogoId : undefined,
            updatedBy: String(x.updatedBy ?? ""),
          }
        })
      )
    })
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, idsKey])

  const pedidosDeHoy = useMemo(() => {
    return gruposVisibles.map((grupo) => {
      const pedidosGrupo = pedidosRaw.filter(
        (p) =>
          p.grupoPedidoId === grupo.id &&
          (p.estado === "enviado" || p.estado === "en_preparacion")
      )
      const pedidosGestionados = pedidosRaw.filter(
        (p) =>
          p.grupoPedidoId === grupo.id &&
          (p.estado === "despachado" || p.estado === "recibido")
      )
      const pedidosBorrador = pedidosRaw.filter(
        (p) => p.grupoPedidoId === grupo.id && p.estado === "borrador"
      )
      const despachadorNombre = nombrePorLocationId.get(despachadorLocationId) ?? despachadorLocationId
      const autoPedidos = buildAutoPedidosPorOperador(
        grupo.id,
        grupo.nombre,
        despachadorLocationId,
        despachadorNombre,
        stockFilas,
        [...pedidosGrupo, ...pedidosGestionados, ...pedidosBorrador],
        nombrePorLocationId
      )
      return { grupo, pedidos: pedidosGrupo, autoPedidos }
    })
  }, [gruposVisibles, pedidosRaw, stockFilas, despachadorLocationId, nombrePorLocationId])

  const [gruposEnModoDespacho, setGruposEnModoDespacho] = useState<Record<string, boolean>>({})
  const [cantidadesDespacho, setCantidadesDespachoState] = useState<Record<string, Record<string, number>>>({})

  const setCantidadDespacho = (grupoId: string, productoId: string, pedidoId: string, cantidad: number) => {
    setCantidadesDespachoState((prev) => ({
      ...prev,
      [grupoId]: { ...(prev[grupoId] ?? {}), [`${productoId}_${pedidoId}`]: cantidad },
    }))
  }

  const aceptarAutoPedido = async (pedido: PedidoFabrica): Promise<string | null> => {
    if (!db || !ownerId || !user) return null
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.PEDIDOS_FABRICA), {
        ownerId,
        origenLocationId: pedido.origenLocationId,
        origenNombre: pedido.origenNombre,
        destinoLocationId: pedido.destinoLocationId,
        destinoNombre: pedido.destinoNombre,
        grupoPedidoId: pedido.grupoPedidoId,
        grupoPedidoNombre: pedido.grupoPedidoNombre,
        estado: "enviado",
        esPendiente: false,
        controlado: false,
        items: pedido.items,
        creadoEn: serverTimestamp(),
        creadoPor: user.uid,
        creadoPorEmail: user.email ?? "",
        actualizadoEn: serverTimestamp(),
      })
      return ref.id
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      })
      return null
    }
  }

  const tomarGrupo = async (
    grupoId: string,
    pedidos: PedidoFabrica[],
    opcion: "todos" | "confirmados" | "manual",
    seleccion?: string[]
  ) => {
    let pedidosATomar: PedidoFabrica[]
    if (opcion === "todos") pedidosATomar = pedidos
    else if (opcion === "confirmados") pedidosATomar = pedidos.filter((p) => !p.id.startsWith("auto_"))
    else pedidosATomar = pedidos.filter((p) => seleccion?.includes(p.id) ?? false)

    for (const pedido of pedidosATomar) {
      if (pedido.estado !== "enviado" && pedido.estado !== "en_preparacion") continue

      let pedidoId = pedido.id
      if (pedido.id.startsWith("auto_")) {
        const nuevoId = await aceptarAutoPedido(pedido)
        if (!nuevoId) {
          toast({ title: "Error", description: "No se pudo registrar el pedido automático", variant: "destructive" })
          return
        }
        pedidoId = nuevoId
      }

      const res = await tomarPedido(pedidoId)
      if (!res.ok) {
        toast({ title: "Error al tomar pedido", description: res.error ?? "Error desconocido", variant: "destructive" })
        return
      }
    }

    setGruposEnModoDespacho((prev) => ({ ...prev, [grupoId]: true }))
    const cantidadesIniciales: Record<string, number> = {}
    pedidos.forEach((p) => p.items.forEach((item) => { cantidadesIniciales[`${item.productoId}_${p.id}`] = 0 }))
    setCantidadesDespachoState((prev) => ({ ...prev, [grupoId]: cantidadesIniciales }))
    toast({ title: "Pedidos tomados", description: "Los pedidos están en preparación." })
  }

  const despacharGrupo = async (
    grupoId: string,
    pedidos: PedidoFabrica[],
    sucursalesAFiltrar?: string[]
  ) => {
    const cantidadesGrupo = cantidadesDespacho[grupoId] ?? {}
    const pedidosADespachar = sucursalesAFiltrar
      ? pedidos.filter((p) => sucursalesAFiltrar.includes(p.id))
      : pedidos

    for (const pedido of pedidosADespachar) {
      const itemsRemito = pedido.items
        .map((item) => ({
          productoId: item.productoId,
          productoNombre: item.productoNombre,
          cantidadPedida: item.cantidadPedida,
          cantidadEnviada: cantidadesGrupo[`${item.productoId}_${pedido.id}`] ?? 0,
        }))
        .filter((i) => i.cantidadEnviada > 0)

      if (itemsRemito.length === 0) continue

      const res = await crearRemito({
        origenLocationId: pedido.destinoLocationId,
        origenNombre: nombrePorLocationId.get(pedido.destinoLocationId) ?? pedido.destinoNombre,
        destinoLocationId: pedido.origenLocationId,
        destinoNombre: nombrePorLocationId.get(pedido.origenLocationId) ?? pedido.origenNombre,
        pedidoFabricaId: pedido.id.startsWith("auto_") ? undefined : pedido.id,
        items: itemsRemito,
      })

      if (!res.ok) {
        toast({ title: "Error al despachar", description: res.error ?? "Error desconocido", variant: "destructive" })
        return
      }
    }

    setGruposEnModoDespacho((prev) => ({ ...prev, [grupoId]: false }))
    toast({ title: "Remitos creados", description: "Stock descontado y pedidos despachados." })
  }

  return {
    gruposVisibles,
    pedidosDeHoy,
    loading,
    locationId: despachadorLocationId,
    nombrePorLocationId,
    gruposEnModoDespacho,
    cantidadesDespacho,
    setCantidadDespacho,
    tomarGrupo,
    despacharGrupo,
    aceptarAutoPedido,
    pedidosRaw,
    remitosRaw,
    marcarEnCamino,
  }
}
