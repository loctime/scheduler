"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore"
import { useData } from "@/contexts/data-context"
import { getOwnerIdForActor } from "@/hooks/use-owner-id"
import { db, COLLECTIONS } from "@/lib/firebase"
import { seedVencAppIfEmpty } from "@/lib/vencapp-seed"
import {
  createLot,
  createVencAppProduct,
  createZone,
  deleteLot,
  deleteZone,
  updateLot,
  updateZone,
} from "@/lib/vencapp-firestore"
import { useVencAppStore } from "@/hooks/use-vencapp-store"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"

export function useVencAppFirestore() {
  const { user, userData } = useData()
  const ownerId = useMemo(() => getOwnerIdForActor(user, userData), [user, userData])
  const seededRef = useRef(false)

  const {
    productos,
    lots,
    zones,
    loading,
    setProductos,
    setLots,
    setZones,
    setLoading,
  } = useVencAppStore()

  useEffect(() => {
    if (!db || !ownerId) {
      setLoading(false)
      return
    }
    const productsRef = collection(db, COLLECTIONS.PRODUCTS)
    const productsQuery = query(productsRef, where("ownerId", "==", ownerId))
    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Producto[]
      setProductos(data)
    })
    return () => unsubscribe()
  }, [ownerId, setProductos, setLoading])

  useEffect(() => {
    if (!db || !ownerId) {
      setLoading(false)
      return
    }
    const lotsRef = collection(db, COLLECTIONS.LOTS)
    const lotsQuery = query(
      lotsRef,
      where("ownerId", "==", ownerId),
      orderBy("expiryDate", "asc")
    )
    const unsubscribe = onSnapshot(lotsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Lot[]
      setLots(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [ownerId, setLots, setLoading])

  useEffect(() => {
    if (!db || !ownerId) {
      setLoading(false)
      return
    }
    const zonesRef = collection(db, COLLECTIONS.WAREHOUSE_ZONES)
    const zonesQuery = query(zonesRef, where("ownerId", "==", ownerId))
    const unsubscribe = onSnapshot(zonesQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as WarehouseZone[]
      setZones(data)
    })
    return () => unsubscribe()
  }, [ownerId, setZones, setLoading])

  useEffect(() => {
    if (!ownerId || !user?.uid || seededRef.current) return
    seededRef.current = true
    void seedVencAppIfEmpty({ ownerId, userId: user.uid, productos })
  }, [ownerId, user, productos])

  const addProduct = useCallback(
    async (nombre: string, category?: Producto["category"]) => {
      if (!ownerId || !user?.uid) throw new Error("No hay sesiÃ³n")
      return createVencAppProduct({ nombre, category, ownerId, userId: user.uid })
    },
    [ownerId, user]
  )

  const addLot = useCallback(
    async (input: Omit<Lot, "id" | "ownerId" | "userId" | "createdAt" | "updatedAt">) => {
      if (!ownerId || !user?.uid) throw new Error("No hay sesiÃ³n")
      return createLot({ ...input, ownerId, userId: user.uid })
    },
    [ownerId, user]
  )

  const updateLotData = useCallback((lotId: string, data: Partial<Lot>) => updateLot(lotId, data), [])
  const removeLot = useCallback((lotId: string) => deleteLot(lotId), [])

  const addZone = useCallback(
    async (input: Omit<WarehouseZone, "id" | "ownerId" | "userId" | "createdAt" | "updatedAt">) => {
      if (!ownerId || !user?.uid) throw new Error("No hay sesiÃ³n")
      return createZone({ ...input, ownerId, userId: user.uid })
    },
    [ownerId, user]
  )

  const updateZoneData = useCallback((zoneId: string, data: Partial<WarehouseZone>) => updateZone(zoneId, data), [])
  const removeZone = useCallback((zoneId: string) => deleteZone(zoneId), [])

  return {
    ownerId,
    userId: user?.uid ?? null,
    productos,
    lots,
    zones,
    loading,
    addProduct,
    addLot,
    updateLot: updateLotData,
    removeLot,
    addZone,
    updateZone: updateZoneData,
    removeZone,
  }
}
