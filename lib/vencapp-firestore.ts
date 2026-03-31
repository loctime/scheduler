import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import type { Lot, Producto, WarehouseZone } from "@/lib/types"

export function assertFirestore() {
  if (!db) throw new Error("Firestore no configurado")
  return db
}

export async function createVencAppProduct(input: {
  nombre: string
  category?: Producto["category"]
  ownerId: string
  userId: string
}) {
  const firestore = assertFirestore()
  const ref = collection(firestore, COLLECTIONS.PRODUCTS)
  return addDoc(ref, {
    pedidoId: "vencapp",
    nombre: input.nombre,
    category: input.category ?? "Otro",
    ownerId: input.ownerId,
    userId: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function createLot(input: Omit<Lot, "id" | "createdAt" | "updatedAt">) {
  const firestore = assertFirestore()
  const ref = collection(firestore, COLLECTIONS.LOTS)
  return addDoc(ref, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateLot(lotId: string, data: Partial<Lot>) {
  const firestore = assertFirestore()
  const ref = doc(firestore, COLLECTIONS.LOTS, lotId)
  return updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteLot(lotId: string) {
  const firestore = assertFirestore()
  const ref = doc(firestore, COLLECTIONS.LOTS, lotId)
  return deleteDoc(ref)
}

export async function createZone(input: Omit<WarehouseZone, "id" | "createdAt" | "updatedAt">) {
  const firestore = assertFirestore()
  const ref = collection(firestore, COLLECTIONS.WAREHOUSE_ZONES)
  return addDoc(ref, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateZone(zoneId: string, data: Partial<WarehouseZone>) {
  const firestore = assertFirestore()
  const ref = doc(firestore, COLLECTIONS.WAREHOUSE_ZONES, zoneId)
  return updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteZone(zoneId: string) {
  const firestore = assertFirestore()
  const ref = doc(firestore, COLLECTIONS.WAREHOUSE_ZONES, zoneId)
  return deleteDoc(ref)
}

