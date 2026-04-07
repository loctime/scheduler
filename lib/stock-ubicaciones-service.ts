import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore"
import type { DocumentSnapshot } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"

/** ID estable para transacciones: owner + catálogo + ubicación */
export function stockUbicacionDocId(ownerId: string, catalogoId: string, locationId: string): string {
  return `${ownerId}__${catalogoId}__${locationId}`.replace(/\//g, "_")
}

export function stockUbicacionRef(
  firestore: NonNullable<typeof db>,
  ownerId: string,
  catalogoId: string,
  locationId: string
) {
  return doc(firestore, COLLECTIONS.STOCK_UBICACIONES, stockUbicacionDocId(ownerId, catalogoId, locationId))
}

function stockActualFromData(data: Record<string, unknown> | undefined): number {
  if (!data) return 0
  return Math.max(0, Math.floor(Number(data.stockActual) || 0))
}

export async function inicializarStockUbicacion(input: {
  ownerId: string
  catalogoId: string
  locationId: string
  stockMinimo?: number
  orden?: number
  grupoCatalogoId?: string
  userId: string
}): Promise<{ ok: boolean; stockId?: string; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  const firestore = db
  const id = stockUbicacionDocId(input.ownerId, input.catalogoId, input.locationId)
  const sRef = doc(firestore, COLLECTIONS.STOCK_UBICACIONES, id)

  try {
    const existing = await getDoc(sRef)
    if (existing.exists()) {
      return { ok: false, error: "Este producto ya está activo en esta ubicación" }
    }

    const catRef = doc(firestore, COLLECTIONS.CATALOGO, input.catalogoId)
    const catSnap = await getDoc(catRef)
    if (!catSnap.exists()) {
      return { ok: false, error: "El producto no existe en el catálogo" }
    }
    const c = catSnap.data() as Record<string, unknown>
    if (c.ownerId !== input.ownerId) {
      return { ok: false, error: "Producto no pertenece a tu espacio de trabajo" }
    }

    const nombre = String(c.nombre ?? "")
    const unidad = String(c.unidad ?? "U")
    const pedidoId = String(c.pedidoId ?? "")
    const ordenCat = typeof c.orden === "number" ? c.orden : 0
    const minCat = typeof c.stockMinimo === "number" ? c.stockMinimo : 0

    await setDoc(sRef, {
      ownerId: input.ownerId,
      catalogoId: input.catalogoId,
      locationId: input.locationId,
      nombre,
      unidad,
      pedidoId,
      stockActual: 0,
      stockMinimo: input.stockMinimo ?? minCat,
      orden: input.orden ?? ordenCat,
      ...(input.grupoCatalogoId ? { grupoCatalogoId: input.grupoCatalogoId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: input.userId,
    })

    return { ok: true, stockId: id }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al inicializar stock"
    return { ok: false, error: message }
  }
}

export async function setStockUbicacion(input: {
  ownerId: string
  catalogoId: string
  locationId: string
  cantidad: number
  user: { uid: string }
}): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  const firestore = db
  const sRef = stockUbicacionRef(firestore, input.ownerId, input.catalogoId, input.locationId)
  const val = Math.max(0, Math.floor(input.cantidad))

  try {
    const snap = await getDoc(sRef)
    if (!snap.exists()) {
      return {
        ok: false,
        error: "No hay stock registrado para este producto en tu ubicación. Activá el producto primero.",
      }
    }
    const data = snap.data() as Record<string, unknown>
    if (data.ownerId !== input.ownerId) {
      return { ok: false, error: "Sin permiso para modificar este registro" }
    }

    await updateDoc(sRef, {
      stockActual: val,
      updatedAt: serverTimestamp(),
      updatedBy: input.user.uid,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar stock"
    return { ok: false, error: message }
  }
}

export async function moverStock(input: {
  ownerId: string
  catalogoId: string
  origenLocationId: string
  destinoLocationId: string
  cantidad: number
  user: { uid: string }
}): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  const firestore = db
  const q = Math.max(0, Math.floor(input.cantidad))
  if (q <= 0) return { ok: false, error: "La cantidad debe ser mayor a cero" }
  if (input.origenLocationId === input.destinoLocationId) {
    return { ok: false, error: "Origen y destino no pueden ser iguales" }
  }

  const origRef = stockUbicacionRef(firestore, input.ownerId, input.catalogoId, input.origenLocationId)
  const destRef = stockUbicacionRef(firestore, input.ownerId, input.catalogoId, input.destinoLocationId)

  try {
    await runTransaction(firestore, async (tx) => {
      const oSnap = await tx.get(origRef)
      if (!oSnap.exists()) {
        throw new Error("No hay stock registrado en el origen para este producto")
      }
      const o = oSnap.data() as Record<string, unknown>
      if (o.ownerId !== input.ownerId) throw new Error("Origen inválido")
      const origenActual = stockActualFromData(o)
      if (origenActual < q) {
        throw new Error(`Stock insuficiente en origen: hay ${origenActual} y se pidieron ${q}`)
      }

      const dSnap = await tx.get(destRef)
      let catSnapForCreate: DocumentSnapshot | null = null
      if (!dSnap.exists()) {
        const catRef = doc(firestore, COLLECTIONS.CATALOGO, input.catalogoId)
        catSnapForCreate = await tx.get(catRef)
        if (!catSnapForCreate.exists()) throw new Error("Producto de catálogo no encontrado")
        const c = catSnapForCreate.data() as Record<string, unknown>
        if (c.ownerId !== input.ownerId) throw new Error("Catálogo inválido")
      } else {
        const d = dSnap.data() as Record<string, unknown>
        if (d.ownerId !== input.ownerId) throw new Error("Destino inválido")
      }

      tx.update(origRef, {
        stockActual: origenActual - q,
        updatedAt: serverTimestamp(),
        updatedBy: input.user.uid,
      })

      if (dSnap.exists()) {
        const d = dSnap.data() as Record<string, unknown>
        const destNext = stockActualFromData(d) + q
        tx.update(destRef, {
          stockActual: destNext,
          updatedAt: serverTimestamp(),
          updatedBy: input.user.uid,
        })
      } else {
        const c = catSnapForCreate!.data() as Record<string, unknown>
        tx.set(destRef, {
          ownerId: input.ownerId,
          catalogoId: input.catalogoId,
          locationId: input.destinoLocationId,
          nombre: String(c.nombre ?? ""),
          unidad: String(c.unidad ?? "U"),
          pedidoId: String(c.pedidoId ?? ""),
          stockActual: q,
          stockMinimo: typeof c.stockMinimo === "number" ? c.stockMinimo : 0,
          orden: typeof c.orden === "number" ? c.orden : 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: input.user.uid,
        })
      }
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al mover stock"
    return { ok: false, error: message }
  }
}

export async function getStockUbicacion(
  ownerId: string,
  catalogoId: string,
  locationId: string
): Promise<number> {
  if (!db) return 0
  const sRef = stockUbicacionRef(db, ownerId, catalogoId, locationId)
  const snap = await getDoc(sRef)
  if (!snap.exists()) return 0
  return stockActualFromData(snap.data() as Record<string, unknown>)
}

export async function setStockMinimoUbicacion(input: {
  ownerId: string
  catalogoId: string
  locationId: string
  minimo: number
  user: { uid: string }
}): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  const firestore = db
  const sRef = stockUbicacionRef(firestore, input.ownerId, input.catalogoId, input.locationId)
  const val = Math.max(0, Math.floor(input.minimo))

  try {
    const snap = await getDoc(sRef)
    if (!snap.exists()) {
      return { ok: false, error: "No hay stock registrado para este producto en tu ubicación." }
    }
    const data = snap.data() as Record<string, unknown>
    if (data.ownerId !== input.ownerId) {
      return { ok: false, error: "Sin permiso para modificar este registro" }
    }

    await updateDoc(sRef, {
      stockMinimo: val,
      updatedAt: serverTimestamp(),
      updatedBy: input.user.uid,
    })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar stock mínimo"
    return { ok: false, error: message }
  }
}

export async function inicializarGrupoCompleto(input: {
  ownerId: string
  grupoCatalogoId: string
  productos: Array<{ id: string; nombre: string; unidad: string; pedidoId: string; stockMinimo: number; orden: number }>
  locationId: string
  userId: string
}): Promise<{ ok: boolean; error?: string }> {
  console.log("🔧 inicializarGrupoCompleto iniciado con:", input)
  
  if (!db) {
    console.error("❌ Firestore no disponible")
    return { ok: false, error: "Firestore no está disponible" }
  }
  const firestore = db

  try {
    // NOTA: No verificamos existencia previa para evitar errores de permisos en Firestore
    // Si el documento ya existe, se sobreescribirá con stockActual: 0 (aceptable al reactivar grupo)
    console.log("📝 Creando batch con", input.productos.length, "documentos")
    
    const batch = writeBatch(firestore)
    for (const p of input.productos) {
      const id = stockUbicacionDocId(input.ownerId, p.id, input.locationId)
      const sRef = doc(firestore, COLLECTIONS.STOCK_UBICACIONES, id)
      batch.set(sRef, {
        ownerId: input.ownerId,
        catalogoId: p.id,
        locationId: input.locationId,
        nombre: p.nombre,
        unidad: p.unidad,
        pedidoId: p.pedidoId,
        stockActual: 0, // Si el doc ya existía, se resetea a 0 al reactivar
        stockMinimo: p.stockMinimo,
        orden: p.orden,
        grupoCatalogoId: input.grupoCatalogoId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: input.userId,
      })
    }
    
    console.log("💾 Ejecutando batch...")
    await batch.commit()
    console.log("✅ Batch ejecutado exitosamente")
    return { ok: true }
  } catch (e) {
    console.error("❌ Error en inicializarGrupoCompleto:", e)
    const message = e instanceof Error ? e.message : "Error al inicializar grupo"
    return { ok: false, error: message }
  }
}

export async function desactivarGrupo(input: {
  ownerId: string
  grupoCatalogoId: string
  locationId: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  const firestore = db

  try {
    const q = query(
      collection(firestore, COLLECTIONS.STOCK_UBICACIONES),
      where("ownerId", "==", input.ownerId),
      where("locationId", "==", input.locationId),
      where("grupoCatalogoId", "==", input.grupoCatalogoId)
    )
    const snap = await getDocs(q)
    if (snap.empty) return { ok: true }

    const batch = writeBatch(firestore)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al desactivar grupo"
    return { ok: false, error: message }
  }
}

/** Sincroniza snapshots de nombre/unidad/pedidoId desde el catálogo hacia todas las filas de stock */
export async function syncStockSnapshotsFromCatalogo(
  ownerId: string,
  catalogoId: string,
  nombre: string,
  unidad: string,
  pedidoId: string
): Promise<void> {
  if (!db) return
  const qy = query(
    collection(db, COLLECTIONS.STOCK_UBICACIONES),
    where("ownerId", "==", ownerId),
    where("catalogoId", "==", catalogoId)
  )
  const snap = await getDocs(qy)
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      nombre,
      unidad,
      pedidoId,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}
