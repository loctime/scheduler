import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { syncStockSnapshotsFromCatalogo } from "@/lib/stock-ubicaciones-service"

export type ActualizarCatalogoChanges = Partial<{
  nombre: string
  unidad: string
  categoria: string | null
  pedidoId: string
  stockMinimo: number
  orden: number
}>

export async function crearProductoCatalogo(input: {
  ownerId: string
  nombre: string
  unidad: string
  pedidoId: string
  stockMinimo?: number
  categoria?: string
  orden?: number
  user: { uid: string }
}): Promise<{ ok: boolean; catalogoId?: string; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  if (!input.nombre.trim()) return { ok: false, error: "El nombre es obligatorio" }

  try {
    const ref = await addDoc(collection(db, COLLECTIONS.CATALOGO), {
      ownerId: input.ownerId,
      nombre: input.nombre.trim(),
      unidad: input.unidad.trim() || "U",
      pedidoId: input.pedidoId,
      stockMinimo: input.stockMinimo ?? 0,
      ...(input.categoria?.trim() ? { categoria: input.categoria.trim() } : {}),
      orden: input.orden ?? 0,
      activo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.user.uid,
    })
    return { ok: true, catalogoId: ref.id }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al crear producto"
    return { ok: false, error: message }
  }
}

export async function actualizarProductoCatalogo(
  catalogoId: string,
  changes: ActualizarCatalogoChanges,
  ownerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  const ref = doc(db, COLLECTIONS.CATALOGO, catalogoId)

  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) return { ok: false, error: "Producto no encontrado" }
    const cur = snap.data() as Record<string, unknown>
    if (cur.ownerId !== ownerId) return { ok: false, error: "Sin permiso" }

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    }
    if (changes.nombre !== undefined) payload.nombre = changes.nombre.trim()
    if (changes.unidad !== undefined) payload.unidad = changes.unidad.trim() || "U"
    if (changes.categoria !== undefined) {
      payload.categoria =
        changes.categoria === null || changes.categoria === ""
          ? deleteField()
          : changes.categoria.trim()
    }
    if (changes.pedidoId !== undefined) payload.pedidoId = changes.pedidoId
    if (changes.stockMinimo !== undefined) payload.stockMinimo = Math.max(0, Math.floor(changes.stockMinimo))
    if (changes.orden !== undefined) payload.orden = Math.floor(changes.orden)

    await updateDoc(ref, payload)

    const nextNombre = (changes.nombre !== undefined ? changes.nombre : String(cur.nombre ?? "")).trim()
    const nextUnidad = (changes.unidad !== undefined ? changes.unidad : String(cur.unidad ?? "U")).trim() || "U"
    const nextPedidoId =
      changes.pedidoId !== undefined ? changes.pedidoId : String(cur.pedidoId ?? "")

    if (
      changes.nombre !== undefined ||
      changes.unidad !== undefined ||
      changes.pedidoId !== undefined
    ) {
      await syncStockSnapshotsFromCatalogo(ownerId, catalogoId, nextNombre, nextUnidad, nextPedidoId)
    }

    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar"
    return { ok: false, error: message }
  }
}

export async function toggleProductoActivo(
  catalogoId: string,
  activo: boolean,
  ownerId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }
  const ref = doc(db, COLLECTIONS.CATALOGO, catalogoId)

  try {
    const snap = await getDoc(ref)
    if (!snap.exists()) return { ok: false, error: "Producto no encontrado" }
    if ((snap.data() as Record<string, unknown>).ownerId !== ownerId) {
      return { ok: false, error: "Sin permiso" }
    }
    await updateDoc(ref, { activo, updatedAt: serverTimestamp() })
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar estado"
    return { ok: false, error: message }
  }
}
