import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore"
import type { DocumentData, DocumentReference, DocumentSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { stockUbicacionRef } from "@/lib/stock-ubicaciones-service"
import type {
  PedidoFabricaItem,
  RecepcionLogItem,
  RemitoLogItem,
  StatusHistoryEntry,
} from "@/lib/logistica-types"
import { canUser, type PermissionUser } from "@/lib/permissions"

type LogisticaActor = PermissionUser & { email?: string }

const REMITOS_COUNTER_DOC_ID = "remitos_log"

function padNumber(value: number, size = 6) {
  return String(value).padStart(size, "0")
}

function makeHistoryEntry(
  status: string,
  user: LogisticaActor,
  nota?: string
): StatusHistoryEntry {
  return {
    status,
    timestamp: Timestamp.now(),
    userId: user.uid ?? "",
    userName: user.email?.trim() ?? user.uid ?? "",
    role: user.role ?? "",
    locationId: user.locationId ?? "",
    ...(nota?.trim() ? { nota: nota.trim() } : {}),
  }
}

function stockActualUbicacion(data: Record<string, unknown>): number {
  return Math.max(0, Math.floor(Number(data.stockActual) || 0))
}

export async function crearPedidoFabrica(input: {
  ownerId: string
  origenLocationId: string
  origenNombre: string
  destinoLocationId: string
  destinoNombre: string
  grupoPedidoId: string
  grupoPedidoNombre: string
  items: PedidoFabricaItem[]
  observacion?: string
  esPendiente?: boolean
  pedidoOrigenId?: string
  user: LogisticaActor
}): Promise<{ ok: boolean; pedidoId?: string; error?: string }> {
  if (!db) {
    return { ok: false, error: "Firestore no está disponible" }
  }
  if (!canUser(input.user, "crear_pedido")) {
    return { ok: false, error: "No tenés permiso para crear pedidos" }
  }
  if (!input.items.length) {
    return { ok: false, error: "El pedido debe incluir al menos un ítem" }
  }
  for (const it of input.items) {
    if (it.cantidadPedida <= 0) {
      return { ok: false, error: `Cantidad inválida para ${it.productoNombre}` }
    }
  }

  try {
    const ref = await addDoc(collection(db, COLLECTIONS.PEDIDOS_FABRICA), {
      ownerId: input.ownerId,
      origenLocationId: input.origenLocationId,
      origenNombre: input.origenNombre,
      destinoLocationId: input.destinoLocationId,
      destinoNombre: input.destinoNombre,
      grupoPedidoId: input.grupoPedidoId,
      grupoPedidoNombre: input.grupoPedidoNombre,
      estado: "enviado",
      esPendiente: input.esPendiente ?? false,
      ...(input.pedidoOrigenId ? { pedidoOrigenId: input.pedidoOrigenId } : {}),
      items: input.items,
      ...(input.observacion?.trim() ? { observacion: input.observacion.trim() } : {}),
      creadoEn: serverTimestamp(),
      creadoPor: input.user.uid ?? "",
      creadoPorEmail: input.user.email?.trim() ?? "",
      actualizadoEn: serverTimestamp(),
    })
    return { ok: true, pedidoId: ref.id }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al crear el pedido"
    return { ok: false, error: message }
  }
}

export async function crearRemito(input: {
  ownerId: string
  origenLocationId: string
  origenNombre: string
  destinoLocationId: string
  destinoNombre: string
  pedidoFabricaId?: string
  items: RemitoLogItem[]
  observacion?: string
  user: LogisticaActor
}): Promise<{ ok: boolean; remitoId?: string; error?: string }> {
  if (!db) {
    return { ok: false, error: "Firestore no está disponible" }
  }
  if (!canUser(input.user, "crear_pedido")) {
    return { ok: false, error: "No tenés permiso para crear remitos" }
  }
  if (!input.items.length) {
    return { ok: false, error: "El remito debe incluir al menos un ítem" }
  }
  for (const it of input.items) {
    if (it.cantidadEnviada <= 0) {
      return { ok: false, error: `La cantidad enviada debe ser mayor a 0 (${it.productoNombre})` }
    }
  }

  const firestore = db
  const remitoRef = doc(collection(firestore, COLLECTIONS.REMITOS_LOG))
  const counterRef = doc(firestore, COLLECTIONS.COUNTERS, REMITOS_COUNTER_DOC_ID)
  const pedidoRef = input.pedidoFabricaId
    ? doc(firestore, COLLECTIONS.PEDIDOS_FABRICA, input.pedidoFabricaId)
    : null

  try {
    await runTransaction(firestore, async (tx) => {
      const counterSnap = await tx.get(counterRef)
      const counterData = counterSnap.exists() ? (counterSnap.data() as Record<string, unknown>) : null
      const current = typeof counterData?.nextNumber === "number" ? counterData.nextNumber : 1
      const numero = `REM-${padNumber(current)}`

      const stockRows: Array<{
        ref: DocumentReference<DocumentData>
        item: RemitoLogItem
        actual: number
      }> = []

      for (const item of input.items) {
        const sRef = stockUbicacionRef(firestore, input.ownerId, item.productoId, input.origenLocationId)
        const sSnap = await tx.get(sRef)
        if (!sSnap.exists()) {
          throw new Error(
            `El producto «${item.productoNombre}» no tiene stock registrado en el origen (ubicación).`
          )
        }
        const sdata = sSnap.data() as Record<string, unknown>
        if (sdata.ownerId !== input.ownerId) {
          throw new Error(`Stock en origen no válido para ${item.productoNombre}`)
        }
        const actual = stockActualUbicacion(sdata)
        const next = actual - item.cantidadEnviada
        if (next < 0) {
          throw new Error(
            `Stock insuficiente en origen para «${item.productoNombre}»: hay ${actual} unidades y se intentaron enviar ${item.cantidadEnviada}.`
          )
        }
        stockRows.push({ ref: sRef, item, actual })
      }

      let pedidoSnap: DocumentSnapshot | null = null
      if (pedidoRef) {
        pedidoSnap = await tx.get(pedidoRef)
        if (!pedidoSnap.exists()) {
          throw new Error("El pedido interno no existe")
        }
        const pd = pedidoSnap.data() as Record<string, unknown>
        if (pd.ownerId !== input.ownerId) {
          throw new Error("El pedido no pertenece a tu espacio de trabajo")
        }
        if (pd.estado !== "enviado" && pd.estado !== "en_preparacion") {
          throw new Error("Solo se pueden despachar pedidos en estado «enviado» o «en preparación»")
        }
      }

      tx.set(
        counterRef,
        {
          id: REMITOS_COUNTER_DOC_ID,
          prefix: "REM",
          nextNumber: current + 1,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      for (const { ref: sRef, item, actual } of stockRows) {
        const next = actual - item.cantidadEnviada
        tx.update(sRef, {
          stockActual: next,
          updatedAt: serverTimestamp(),
          updatedBy: input.user.uid ?? "",
        })
      }

      tx.set(remitoRef, {
        ownerId: input.ownerId,
        numero,
        origenLocationId: input.origenLocationId,
        origenNombre: input.origenNombre,
        destinoLocationId: input.destinoLocationId,
        destinoNombre: input.destinoNombre,
        ...(input.pedidoFabricaId ? { pedidoFabricaId: input.pedidoFabricaId } : {}),
        estado: "preparado",
        items: input.items,
        ...(input.observacion?.trim() ? { observacion: input.observacion.trim() } : {}),
        creadoEn: serverTimestamp(),
        creadoPor: input.user.uid ?? "",
        creadoPorEmail: input.user.email?.trim() ?? "",
        actualizadoEn: serverTimestamp(),
        stockDescontadoEn: serverTimestamp(),
        statusHistory: [makeHistoryEntry("preparado", input.user)],
      })

      if (pedidoRef && pedidoSnap?.exists()) {
        tx.update(pedidoRef, {
          estado: "despachado",
          actualizadoEn: serverTimestamp(),
        })
      }
    })

    return { ok: true, remitoId: remitoRef.id }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al crear el remito"
    return { ok: false, error: message }
  }
}

function recepcionDocIdForRemito(remitoId: string) {
  return `by_remito_${remitoId}`
}

export async function confirmarRecepcion(input: {
  ownerId: string
  remitoId: string
  items: RecepcionLogItem[]
  observacion?: string
  user: LogisticaActor
}): Promise<{ ok: boolean; recepcionId?: string; pendientesGenerados?: number; error?: string }> {
  if (!db) {
    return { ok: false, error: "Firestore no está disponible" }
  }
  if (!canUser(input.user, "recibir_pedido")) {
    return { ok: false, error: "No tenés permiso para confirmar recepciones" }
  }
  if (!input.items.length) {
    return { ok: false, error: "Indicá al menos un ítem recibido" }
  }

  const firestore = db
  const remitoRef = doc(firestore, COLLECTIONS.REMITOS_LOG, input.remitoId)
  const recepcionRef = doc(firestore, COLLECTIONS.RECEPCIONES_LOG, recepcionDocIdForRemito(input.remitoId))

  try {
    let pendientesCount = 0

    await runTransaction(firestore, async (tx) => {
      const recepcionSnap = await tx.get(recepcionRef)
      if (recepcionSnap.exists()) {
        throw new Error("Este remito ya tiene una recepción registrada")
      }

      const remitoSnap = await tx.get(remitoRef)
      if (!remitoSnap.exists()) {
        throw new Error("Remito no encontrado")
      }
      const remito = remitoSnap.data() as Record<string, unknown>
      if (remito.ownerId !== input.ownerId) {
        throw new Error("El remito no pertenece a tu espacio de trabajo")
      }
      const estado = remito.estado as string
      if (estado !== "preparado" && estado !== "en_camino") {
        throw new Error("Solo se pueden recepcionar remitos preparados o en camino")
      }

      const remitoItems = remito.items as RemitoLogItem[]
      const byProduct = new Map(remitoItems.map((i) => [i.productoId, i]))

      for (const line of input.items) {
        const orig = byProduct.get(line.productoId)
        if (!orig) {
          throw new Error(`El producto «${line.productoNombre}» no figura en el remito`)
        }
        if (line.cantidadRecibida < 0) {
          throw new Error(`Cantidad recibida inválida para ${line.productoNombre}`)
        }
      }

      const pedidoFabricaId = remito.pedidoFabricaId as string | undefined
      let pedidoOrigenSnap: DocumentSnapshot | null = null
      if (pedidoFabricaId) {
        const pref = doc(firestore, COLLECTIONS.PEDIDOS_FABRICA, pedidoFabricaId)
        pedidoOrigenSnap = await tx.get(pref)
      }

      const destinoLocationId = String(remito.destinoLocationId ?? "")

      type StockRecepRow =
        | { mode: "update"; ref: DocumentReference<DocumentData>; line: RecepcionLogItem; actual: number }
        | {
            mode: "create"
            ref: DocumentReference<DocumentData>
            line: RecepcionLogItem
            catalog: Record<string, unknown>
          }

      const stockRows: StockRecepRow[] = []

      for (const line of input.items) {
        const sRef = stockUbicacionRef(firestore, input.ownerId, line.productoId, destinoLocationId)
        const sSnap = await tx.get(sRef)
        if (!sSnap.exists()) {
          const catRef = doc(firestore, COLLECTIONS.CATALOGO, line.productoId)
          const catSnap = await tx.get(catRef)
          if (!catSnap.exists()) {
            throw new Error(`Producto de catálogo no encontrado: ${line.productoNombre}`)
          }
          const c = catSnap.data() as Record<string, unknown>
          if (c.ownerId !== input.ownerId) {
            throw new Error(`El producto ${line.productoNombre} no pertenece a tu espacio de trabajo`)
          }
          stockRows.push({ mode: "create", ref: sRef, line, catalog: c })
        } else {
          const sdata = sSnap.data() as Record<string, unknown>
          if (sdata.ownerId !== input.ownerId) {
            throw new Error(`Stock en destino no válido para ${line.productoNombre}`)
          }
          const actual = stockActualUbicacion(sdata)
          stockRows.push({ mode: "update", ref: sRef, line, actual })
        }
      }

      for (const row of stockRows) {
        if (row.mode === "update") {
          const next = row.actual + row.line.cantidadRecibida
          tx.update(row.ref, {
            stockActual: next,
            updatedAt: serverTimestamp(),
            updatedBy: input.user.uid ?? "",
          })
        } else {
          const c = row.catalog
          tx.set(row.ref, {
            ownerId: input.ownerId,
            catalogoId: row.line.productoId,
            locationId: destinoLocationId,
            nombre: String(c.nombre ?? row.line.productoNombre),
            unidad: String(c.unidad ?? "U"),
            pedidoId: String(c.pedidoId ?? ""),
            stockActual: row.line.cantidadRecibida,
            stockMinimo: typeof c.stockMinimo === "number" ? c.stockMinimo : 0,
            orden: typeof c.orden === "number" ? c.orden : 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: input.user.uid ?? "",
          })
        }
      }

      const remitoNumero = String(remito.numero ?? "")
      tx.set(recepcionRef, {
        ownerId: input.ownerId,
        remitoId: input.remitoId,
        remitoNumero,
        origenLocationId: remito.origenLocationId,
        destinoLocationId: remito.destinoLocationId,
        destinoNombre: remito.destinoNombre,
        items: input.items,
        ...(input.observacion?.trim() ? { observacion: input.observacion.trim() } : {}),
        creadoEn: serverTimestamp(),
        creadoPor: input.user.uid ?? "",
        creadoPorEmail: input.user.email?.trim() ?? "",
        stockActualizadoEn: serverTimestamp(),
      })

      tx.update(remitoRef, {
        estado: "entregado",
        actualizadoEn: serverTimestamp(),
        statusHistory: arrayUnion(makeHistoryEntry("entregado", input.user, input.observacion)),
      })

      if (pedidoFabricaId && pedidoOrigenSnap?.exists()) {
        const pref = doc(firestore, COLLECTIONS.PEDIDOS_FABRICA, pedidoFabricaId)
        tx.update(pref, {
          estado: "recibido",
          actualizadoEn: serverTimestamp(),
        })
      }

      const faltanteItems: PedidoFabricaItem[] = []
      for (const line of input.items) {
        const orig = byProduct.get(line.productoId)!
        const faltante = orig.cantidadEnviada - line.cantidadRecibida
        if (faltante > 0) {
          faltanteItems.push({
            productoId: line.productoId,
            productoNombre: line.productoNombre,
            cantidadSugerida: faltante,
            cantidadPedida: faltante,
            ...(line.comentario?.trim() ? { comentario: line.comentario.trim() } : {}),
          })
        }
      }

      pendientesCount = faltanteItems.length

      if (faltanteItems.length > 0) {
        const pedidoPendienteRef = doc(collection(firestore, COLLECTIONS.PEDIDOS_FABRICA))
        const po = pedidoOrigenSnap?.exists()
          ? (pedidoOrigenSnap.data() as Record<string, unknown>)
          : null
        const grupoPedidoId = (po?.grupoPedidoId as string) || "faltante"
        const grupoPedidoNombre = (po?.grupoPedidoNombre as string) || "Faltante por recepción"

        tx.set(pedidoPendienteRef, {
          ownerId: input.ownerId,
          origenLocationId: remito.destinoLocationId,
          origenNombre: remito.destinoNombre,
          destinoLocationId: remito.origenLocationId,
          destinoNombre: remito.origenNombre,
          grupoPedidoId,
          grupoPedidoNombre,
          estado: "enviado",
          esPendiente: true,
          ...(pedidoFabricaId ? { pedidoOrigenId: pedidoFabricaId } : {}),
          remitoOrigenId: input.remitoId,
          items: faltanteItems,
          observacion: `Generado automáticamente por faltante en recepción del remito ${remitoNumero}`,
          creadoEn: serverTimestamp(),
          creadoPor: input.user.uid,
          creadoPorEmail: input.user.email?.trim() ?? "",
          actualizadoEn: serverTimestamp(),
        })
      }
    })

    return { ok: true, recepcionId: recepcionDocIdForRemito(input.remitoId), pendientesGenerados: pendientesCount }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al confirmar la recepción"
    return { ok: false, error: message }
  }
}

export async function marcarEnCamino(input: {
  remitoId: string
  ownerId: string
  user: LogisticaActor | null | undefined
}): Promise<{ ok: boolean; error?: string }> {
  if (!db) {
    return { ok: false, error: "Firestore no está disponible" }
  }
  const admin = canUser(input.user, "ver_admin")
  const delivery = input.user?.role === "delivery"
  if (!admin && !delivery) {
    return { ok: false, error: "No tenés permiso para marcar el remito en camino" }
  }

  try {
    const remitoRef = doc(db, COLLECTIONS.REMITOS_LOG, input.remitoId)
    const snap = await getDoc(remitoRef)
    if (!snap.exists()) {
      return { ok: false, error: "Remito no encontrado" }
    }
    const data = snap.data() as Record<string, unknown>
    if (data.ownerId !== input.ownerId) {
      return { ok: false, error: "El remito no pertenece a tu espacio de trabajo" }
    }
    const estado = data.estado as string
    if (estado === "cancelado" || estado === "entregado") {
      return { ok: false, error: "El remito ya no puede pasar a en camino" }
    }
    if (estado !== "preparado" && estado !== "en_camino") {
      return { ok: false, error: "Estado de remito no válido para esta acción" }
    }

    await updateDoc(remitoRef, {
      estado: "en_camino",
      actualizadoEn: serverTimestamp(),
      statusHistory: arrayUnion(makeHistoryEntry("en_camino", input.user as LogisticaActor)),
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar el remito"
    return { ok: false, error: message }
  }
}

export async function tomarPedido(input: {
  pedidoId: string
  ownerId: string
  user: LogisticaActor
}): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  if (!canUser(input.user, "crear_pedido")) return { ok: false, error: "No tenés permiso" }
  try {
    const ref = doc(db, COLLECTIONS.PEDIDOS_FABRICA, input.pedidoId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return { ok: false, error: "Pedido no encontrado" }
    const data = snap.data() as Record<string, unknown>
    if (data.ownerId !== input.ownerId) return { ok: false, error: "El pedido no pertenece a tu espacio de trabajo" }
    if (data.estado !== "enviado") return { ok: false, error: "Solo se pueden tomar pedidos en estado «enviado»" }
    await updateDoc(ref, { estado: "en_preparacion", actualizadoEn: serverTimestamp() })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al tomar el pedido" }
  }
}

export async function actualizarItemsPedido(input: {
  pedidoId: string
  ownerId: string
  items: PedidoFabricaItem[]
  user: LogisticaActor
}): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  if (!canUser(input.user, "crear_pedido")) return { ok: false, error: "No tenés permiso" }
  try {
    const ref = doc(db, COLLECTIONS.PEDIDOS_FABRICA, input.pedidoId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return { ok: false, error: "Pedido no encontrado" }
    const data = snap.data() as Record<string, unknown>
    if (data.ownerId !== input.ownerId) return { ok: false, error: "El pedido no pertenece a tu espacio de trabajo" }
    if (data.estado !== "enviado") return { ok: false, error: "No se puede editar un pedido que ya fue tomado o despachado" }
    await updateDoc(ref, { items: input.items, actualizadoEn: serverTimestamp() })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar el pedido" }
  }
}
