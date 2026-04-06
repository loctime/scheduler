"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { GrupoCatalogoUI } from "@/lib/catalogo-types"
import { normalizeDespachadoresGrupo, normalizeProductosIds } from "@/lib/catalogo-normalize"

/**
 * Subscribes to the GRUPOS_CATALOGO collection filtered by `ownerId`.
 * Returns a sorted list of groups, each with their `productosIds` normalized.
 */
export function useGruposCatalogo(ownerId: string | null): {
  gruposCatalogo: GrupoCatalogoUI[]
} {
  const [gruposCatalogo, setGruposCatalogo] = useState<GrupoCatalogoUI[]>([])

  useEffect(() => {
    if (!db || !ownerId) {
      setGruposCatalogo([])
      return
    }
    const gq = query(collection(db, COLLECTIONS.GRUPOS_CATALOGO), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(
      gq,
      (snap) => {
        const list: GrupoCatalogoUI[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>
          return {
            id: d.id,
            nombre: String(x.nombre ?? ""),
            ownerId: String(x.ownerId ?? ""),
            createdBy: String(x.createdBy ?? ""),
            createdAt: x.createdAt,
            despachadores: normalizeDespachadoresGrupo(x),
            productosIds: normalizeProductosIds(x.productosIds),
            diasEnvio: x.diasEnvio as number[] || undefined,
          }
        })
        list.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setGruposCatalogo(list)
      },
      (err) => {
        console.warn("[catalogo] grupos listener:", err)
      }
    )
    return () => unsub()
  }, [ownerId])

  return { gruposCatalogo }
}
