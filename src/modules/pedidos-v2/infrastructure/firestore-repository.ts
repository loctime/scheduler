import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  getDoc,
  updateDoc,
  increment
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type {
  Pedido,
  RemitoSalida,
  Recepcion,
  Pendiente,
  Consolidado,
  AuditLog,
  Counter
} from "../domain/types"
import {
  calculatePedidoTotales,
  calculateRemitoTotales,
  calculateRecepcionTotales,
  validatePedidoCreate,
  validateRemitoSalidaEmit,
  validateTransporte,
  validateRecepcion
} from "../domain/rules"

type AuditLogInsert = Omit<AuditLog, "id" | "createdAt"> & {
  createdAt: ReturnType<typeof serverTimestamp>
}

const padNumber = (value: number, size = 6) => String(value).padStart(size, "0")

async function nextCounter(counterId: string, prefix: string): Promise<string> {
  if (!db) throw new Error("Firestore no disponible")
  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterId)

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const data = snap.exists() ? (snap.data() as Counter) : null
    const current = data?.nextNumber ?? 1
    const numero = `${prefix}-${padNumber(current)}`
    tx.set(counterRef, {
      id: counterId,
      prefix,
      nextNumber: current + 1,
      updatedAt: serverTimestamp()
    }, { merge: true })
    return numero
  })
}

export async function createPedido(input: Omit<Pedido, "id" | "numeroPedido" | "totales" | "createdAt" | "updatedAt">) {
  if (!db) throw new Error("Firestore no disponible")
  const errors = validatePedidoCreate({ items: input.items })
  if (errors.length) throw new Error(errors.join(" | "))

  const numeroPedido = await nextCounter("pedido", "PED")
  const totales = calculatePedidoTotales(input.items)

  const pedidoRef = await addDoc(collection(db, COLLECTIONS.PEDIDOS), {
    ...input,
    numeroPedido,
    totales,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
    entityType: "pedido",
    entityId: pedidoRef.id,
    pedidoId: pedidoRef.id,
    accion: "created",
    descripcion: "Pedido creado",
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdByEmail: input.createdByEmail
  } satisfies AuditLogInsert)

  return { id: pedidoRef.id, numeroPedido }
}

export async function emitirRemitoSalida(input: Omit<RemitoSalida, "id" | "numero" | "totales" | "createdAt">) {
  if (!db) throw new Error("Firestore no disponible")
  const errors = validateRemitoSalidaEmit({ items: input.items, firmaEmisor: input.firmaEmisor })
  if (errors.length) throw new Error(errors.join(" | "))

  const numero = await nextCounter("remito_salida", "RS")
  const totales = calculateRemitoTotales(input.items)

  const remitoRef = await addDoc(collection(db, COLLECTIONS.REMITOS_SALIDA), {
    ...input,
    numero,
    totales,
    createdAt: serverTimestamp()
  })

  const pedidoRef = doc(db, COLLECTIONS.PEDIDOS, input.pedidoId)
  await updateDoc(pedidoRef, {
    remitoSalidaId: remitoRef.id,
    estado: "preparado",
    updatedAt: serverTimestamp()
  })

  await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
    entityType: "remito_salida",
    entityId: remitoRef.id,
    pedidoId: input.pedidoId,
    accion: "created",
    descripcion: "Remito de salida emitido",
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdByEmail: input.createdByEmail
  } satisfies AuditLogInsert)

  return { id: remitoRef.id, numero }
}

export async function registrarTransporte(remitoSalidaId: string, pedidoId: string, firmaTransportista: RemitoSalida["firmaTransportista"], items?: RemitoSalida["items"]) {
  if (!db) throw new Error("Firestore no disponible")
  if (!firmaTransportista?.firmado) throw new Error("Firma transportista requerida")

  const remitoRef = doc(db, COLLECTIONS.REMITOS_SALIDA, remitoSalidaId)
  const remitoSnap = await getDoc(remitoRef)
  if (!remitoSnap.exists()) throw new Error("Remito no encontrado")
  const remitoData = remitoSnap.data() as RemitoSalida

  const updatedItems = items ?? remitoData.items
  const errors = validateTransporte({ items: updatedItems, firmaTransportista })
  if (errors.length) throw new Error(errors.join(" | "))

  await updateDoc(remitoRef, {
    estado: "en_transito",
    firmaTransportista,
    items: updatedItems,
    totales: calculateRemitoTotales(updatedItems)
  })

  await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedidoId), {
    estado: "en_transporte",
    updatedAt: serverTimestamp()
  })

  await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
    entityType: "remito_salida",
    entityId: remitoSalidaId,
    pedidoId,
    accion: "signed",
    descripcion: "Transporte registrado en remito de salida",
    createdAt: serverTimestamp(),
    createdBy: firmaTransportista.firmadoBy,
    createdByName: firmaTransportista.firmadoByName,
    createdByEmail: firmaTransportista.firmadoByEmail
  } satisfies AuditLogInsert)
}

export async function confirmarRecepcion(input: Omit<Recepcion, "id" | "numero" | "totales" | "createdAt">) {
  if (!db) throw new Error("Firestore no disponible")
  const firestore = db
  const errors = validateRecepcion({ items: input.items, firma: input.firma })
  if (errors.length) throw new Error(errors.join(" | "))

  const pedidoSnap = await getDoc(doc(firestore, COLLECTIONS.PEDIDOS, input.pedidoId))
  if (!pedidoSnap.exists()) throw new Error("Pedido no encontrado")
  const pedidoData = pedidoSnap.data() as Pedido

  const numero = await nextCounter("recepcion", "REC")
  const totales = calculateRecepcionTotales(input.items)

  const recepcionRef = await addDoc(collection(firestore, COLLECTIONS.RECEPCIONES), {
    ...input,
    pedidoNumero: input.pedidoNumero || pedidoData.numeroPedido,
    numero,
    totales,
    createdAt: serverTimestamp()
  })

  await updateDoc(doc(firestore, COLLECTIONS.PEDIDOS, input.pedidoId), {
    recepcionId: recepcionRef.id,
    estado: totales.cantidadPendiente > 0 ? "recibido" : "cerrado",
    updatedAt: serverTimestamp()
  })

  const batch = writeBatch(firestore)

  input.items.forEach((item) => {
    const productRef = doc(firestore, COLLECTIONS.PRODUCTS, item.productId)
    batch.update(productRef, {
      stockActual: increment(item.cantidadRecibida),
      updatedAt: serverTimestamp()
    })
  })

  const pendientes: Pendiente[] = input.items
    .filter((item) => item.cantidadPendiente > 0)
    .map((item) => ({
      id: `${input.pedidoId}_${item.productId}`,
      pedidoId: input.pedidoId,
      pedidoNumero: input.pedidoNumero || pedidoData.numeroPedido,
      recepcionId: recepcionRef.id,
      productId: item.productId,
      productNombre: item.productNombre,
      unidad: item.unidad,
      origenId: pedidoData.origen?.id || "",
      origenNombre: pedidoData.origen?.nombre || "",
      destinoId: pedidoData.destino?.id || "",
      destinoNombre: pedidoData.destino?.nombre || "",
      cantidadPendiente: item.cantidadPendiente,
      estado: "activo",
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
      pedidoResolucionId: null
    }))

  pendientes.forEach((pendiente) => {
    const pendienteRef = doc(firestore, COLLECTIONS.PEDIDOS_PENDIENTES, pendiente.id)
    batch.set(pendienteRef, {
      ...pendiente,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true })
  })

  const consolidado: Consolidado = {
    id: input.pedidoId,
    pedidoId: input.pedidoId,
    numeroPedido: input.pedidoNumero || pedidoData.numeroPedido,
    estado: totales.cantidadPendiente > 0 ? "recibido_parcial" : "recibido_completo",
    refs: {
      remitoSalidaId: input.remitoSalidaId,
      recepcionId: recepcionRef.id
    },
    resumen: {
      cantidadPedida: input.items.reduce((acc, item) => acc + item.cantidadPedida, 0),
      cantidadPreparada: input.items.reduce((acc, item) => acc + item.cantidadPreparada, 0),
      cantidadTransportada: input.items.reduce((acc, item) => acc + item.cantidadTransportada, 0),
      cantidadRecibida: input.items.reduce((acc, item) => acc + item.cantidadRecibida, 0),
      cantidadPendiente: input.items.reduce((acc, item) => acc + item.cantidadPendiente, 0)
    },
    items: input.items.map((item) => ({
      productId: item.productId,
      productNombre: item.productNombre,
      cantidadPedida: item.cantidadPedida,
      cantidadPreparada: item.cantidadPreparada,
      cantidadTransportada: item.cantidadTransportada,
      cantidadRecibida: item.cantidadRecibida,
      cantidadPendiente: item.cantidadPendiente,
      estadoFinal: item.estadoLinea
    })),
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const consolidadoRef = doc(firestore, COLLECTIONS.PEDIDOS_CONSOLIDADOS, input.pedidoId)
  batch.set(consolidadoRef, {
    ...consolidado,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true })

  await batch.commit()

  await addDoc(collection(firestore, COLLECTIONS.AUDIT_LOGS), {
    entityType: "recepcion",
    entityId: recepcionRef.id,
    pedidoId: input.pedidoId,
    accion: "confirmed",
    descripcion: "Recepcion confirmada",
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdByEmail: input.createdByEmail
  } satisfies AuditLogInsert)

  return { id: recepcionRef.id, numero }
}
