"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { CatalogoProducto } from "@/lib/catalogo-types"

/**
 * Subscribes to the CATALOGO collection filtered by `ownerId`.
 * Returns a sorted list of products and a loading flag.
 */
export function useCatalogoProductos(ownerId: string | null): {
  items: CatalogoProducto[]
  loadingItems: boolean
} {
  const [items, setItems] = useState<CatalogoProducto[]>([])
  const [loadingItems, setLoadingItems] = useState(true)

  useEffect(() => {
    if (!db || !ownerId) {
      setItems([])
      setLoadingItems(false)
      return
    }
    setLoadingItems(true)
    const cq = query(collection(db, COLLECTIONS.CATALOGO), where("ownerId", "==", ownerId))
    const unsub = onSnapshot(
      cq,
      (snap) => {
        const rows: CatalogoProducto[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>
          return {
            id: d.id,
            ownerId: String(x.ownerId ?? ""),
            nombre: String(x.nombre ?? ""),
            unidad: String(x.unidad ?? "U"),
            unidadAlternativa:
              typeof x.unidadAlternativa === "string" && x.unidadAlternativa.trim()
                ? x.unidadAlternativa.trim()
                : undefined,
            factorConversion:
              typeof x.factorConversion === "number" &&
              Number.isFinite(x.factorConversion) &&
              x.factorConversion > 0
                ? x.factorConversion
                : undefined,
            proveedor:
              typeof x.proveedor === "string" && x.proveedor.trim()
                ? x.proveedor.trim()
                : undefined,
            categoria: x.categoria ? String(x.categoria) : undefined,
            pedidoId: String(x.pedidoId ?? ""),
            grupoCatalogoId: x.grupoCatalogoId ? String(x.grupoCatalogoId) : undefined,
            stockMinimo: typeof x.stockMinimo === "number" ? x.stockMinimo : 0,
            orden: typeof x.orden === "number" ? x.orden : 0,
            activo: x.activo !== false,
            createdAt: x.createdAt,
            updatedAt: x.updatedAt,
            createdBy: String(x.createdBy ?? ""),
          }
        })
        rows.sort((a, b) => a.nombre.localeCompare(b.nombre))
        setItems(rows)
        setLoadingItems(false)
      },
      (err) => {
        console.warn("[catalogo] productos listener:", err)
        setLoadingItems(false)
      }
    )
    return () => unsub()
  }, [ownerId])

  return { items, loadingItems }
}
