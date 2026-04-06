import { doc, updateDoc } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { CatalogoProducto } from "@/lib/catalogo-types"
import { actualizarProductoCatalogo } from "@/lib/catalogo-service"

/**
 * Syncs product membership for a catalog group.
 *
 * - Products in `selectedIds` but not in `currentIds` are assigned to the group.
 * - Products in `currentIds` but not in `selectedIds` are unassigned from the group.
 * - Updates the group document's `productosIds` field to match `selectedIds`.
 *
 * @param grupoId - Firestore ID of the target group.
 * @param selectedIds - The desired set of product IDs for the group.
 * @param currentIds - The current set of product IDs in the group.
 * @param ownerId - Owner ID used for permission checks in `actualizarProductoCatalogo`.
 * @param productById - Map of product ID → product, used to read `stockMinimo`.
 */
export async function updateGroupProductsMembership(
  grupoId: string,
  selectedIds: string[],
  currentIds: string[],
  ownerId: string,
  productById: Map<string, CatalogoProducto>
): Promise<{ ok: boolean; error?: string }> {
  if (!db) return { ok: false, error: "Firestore no está disponible" }

  const selectedSet = new Set(selectedIds)
  const currentSet = new Set(currentIds)
  const added = selectedIds.filter((id) => !currentSet.has(id))
  const removed = currentIds.filter((id) => !selectedSet.has(id))

  for (const productId of added) {
    const res = await actualizarProductoCatalogo(
      productId,
      {
        grupoCatalogoId: grupoId,
        pedidoId: "",
        stockMinimo: productById.get(productId)?.stockMinimo ?? 0,
      },
      ownerId
    )
    if (!res.ok) return { ok: false, error: res.error ?? "No se pudo asignar producto" }
  }

  for (const productId of removed) {
    const res = await actualizarProductoCatalogo(
      productId,
      { grupoCatalogoId: null, pedidoId: "" },
      ownerId
    )
    if (!res.ok) return { ok: false, error: res.error ?? "No se pudo desasignar producto" }
  }

  await updateDoc(doc(db, COLLECTIONS.GRUPOS_CATALOGO, grupoId), {
    productosIds: [...selectedSet],
  })

  return { ok: true }
}
