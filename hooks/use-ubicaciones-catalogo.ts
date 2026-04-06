"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { UbicacionCatalogo } from "@/lib/catalogo-types"

/**
 * Subscribes to the USERS collection filtered by one or more `ownerId` values
 * and derives the unique set of active locations (despachadores).
 *
 * @param ownerIdsParaUsuarios - Array of ownerIds to query, or `null` to skip.
 */
export function useUbicacionesCatalogo(ownerIdsParaUsuarios: string[] | null): {
  ubicaciones: UbicacionCatalogo[]
} {
  const [ubicaciones, setUbicaciones] = useState<UbicacionCatalogo[]>([])

  useEffect(() => {
    if (!db || !ownerIdsParaUsuarios?.length) {
      setUbicaciones([])
      return
    }
    const ids = ownerIdsParaUsuarios
    const uq =
      ids.length === 1
        ? query(collection(db, COLLECTIONS.USERS), where("ownerId", "==", ids[0]!))
        : query(collection(db, COLLECTIONS.USERS), where("ownerId", "in", ids))
    const unsub = onSnapshot(
      uq,
      (snap) => {
        const byLocation = new Map<string, UbicacionCatalogo>()
        for (const d of snap.docs) {
          const x = d.data() as Record<string, unknown>
          if (x.disabled === true) continue
          const locationName = typeof x.locationName === "string" ? x.locationName.trim() : ""
          if (!locationName) continue
          const locationId = String(x.locationId ?? x.location ?? d.id)
          if (!byLocation.has(locationId)) byLocation.set(locationId, { locationId, locationName })
        }
        const rows = [...byLocation.values()].sort((a, b) =>
          a.locationName.localeCompare(b.locationName)
        )
        setUbicaciones(rows)
      },
      (err) => {
        console.warn("[catalogo] ubicaciones listener:", err)
        setUbicaciones([])
      }
    )
    return () => unsub()
  }, [ownerIdsParaUsuarios])

  return { ubicaciones }
}
