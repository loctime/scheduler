import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import type { DocumentData, DocumentReference, DocumentSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type {
  PedidoFabricaItem,
  RecepcionLogItem,
  RemitoLogItem,
} from "@/lib/logistica-types"
import { canUser, type PermissionUser } from "@/lib/permissions"

type LogisticaActor = PermissionUser & { email?: string }

const REMITOS_COUNTER_DOC_ID = "remitos_log"

function padNumber(value: number, size = 6) {
  return String(value).padStart(size, "0")
}

function stockUnitsFromDoc(data: Record<string, unknown>): number {
  const raw = data.stockActualUnits ?? data.stockActual
  return Math.max(0, Math.floor(Number(raw) || 0))
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
  if (!canUser(input.user, "ver_admin")) {
    return { ok: false, error: "Solo administración puede crear remitos de logística" }
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

      const productRows: Array<{
        ref: DocumentReference<DocumentData>
        item: RemitoLogItem
        actual: number
      }> = []

      for (const item of input.items) {
        const pRef = doc(firestore, COLLECTIONS.PRODUCTS, item.productoId)
        const pSnap = await tx.get(pRef)
        if (!pSnap.exists()) {
          throw new Error(`Producto no encontrado: ${item.productoNombre}`)
        }
        const pdata = pSnap.data() as Record<string, unknown>
        if (pdata.ownerId !== input.ownerId) {
          throw new Error(`El producto ${item.productoNombre} no pertenece a tu espacio de trabajo`)
        }
        const actual = stockUnitsFromDoc(pdata)
        const next = actual - item.cantidadEnviada
        if (next < 0) {
          throw new Error(
            `Stock insuficiente en origen para «${item.productoNombre}»: hay ${actual} unidades y se intentaron enviar ${item.cantidadEnviada}.`
          )
        }
        productRows.push({ ref: pRef, item, actual })
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
        if (pd.estado !== "enviado") {
          throw new Error("Solo se pueden despachar pedidos en estado «enviado»")
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

      for (const { ref: pRef, item, actual } of productRows) {
        const next = actual - item.cantidadEnviada
        tx.update(pRef, {
          stockActualUnits: next,
          updatedAt: serverTimestamp(),
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

      const stockRows: Array<{
        ref: DocumentReference<DocumentData>
        line: RecepcionLogItem
        actual: number
      }> = []

      for (const line of input.items) {
        const pRef = doc(firestore, COLLECTIONS.PRODUCTS, line.productoId)
        const pSnap = await tx.get(pRef)
        if (!pSnap.exists()) {
          throw new Error(`Producto no encontrado: ${line.productoNombre}`)
        }
        const pdata = pSnap.data() as Record<string, unknown>
        if (pdata.ownerId !== input.ownerId) {
          throw new Error(`El producto ${line.productoNombre} no pertenece a tu espacio de trabajo`)
        }
        const actual = stockUnitsFromDoc(pdata)
        stockRows.push({ ref: pRef, line, actual })
      }

      for (const { ref: pRef, line, actual } of stockRows) {
        const next = actual + line.cantidadRecibida
        tx.update(pRef, {
          stockActualUnits: next,
          updatedAt: serverTimestamp(),
        })
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
  user: PermissionUser | null | undefined
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
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar el remito"
    return { ok: false, error: message }
  }
}
