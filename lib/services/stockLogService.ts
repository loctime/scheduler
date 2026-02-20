"use client"

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type StockLogAction =
  | "stock_update"
  | "pedido_confirm"
  | "recepcion_confirm"
  | "stock_clear"
  | "pedido_edit"

interface LogStockActionParams {
  ownerId: string
  productId?: string
  productName?: string

  action: StockLogAction

  previousValue?: number
  newValue?: number

  pedidoId?: string
  recepcionId?: string

  user: {
    uid: string
    email: string
  }

  source?: "pwa" | "web"
}

export async function logStockAction({
  ownerId,
  productId,
  productName,
  action,
  previousValue,
  newValue,
  pedidoId,
  recepcionId,
  user,
  source = "pwa",
}: LogStockActionParams) {
  try {
    // Validar que db esté disponible
    if (!db) {
      console.error("Firestore no está disponible para registrar stock log")
      return
    }

    // Evitar logs innecesarios
    if (
      action === "stock_update" &&
      previousValue !== undefined &&
      newValue !== undefined &&
      previousValue === newValue
    ) {
      return
    }

    const difference =
      previousValue !== undefined && newValue !== undefined
        ? newValue - previousValue
        : undefined

    const logsRef = collection(
      db,
      "apps",
      "horarios",
      "owners",
      ownerId,
      "stock_logs"
    )

    await addDoc(logsRef, {
      ownerId,

      productId: productId ?? null,
      productName: productName ?? null,

      pedidoId: pedidoId ?? null,
      recepcionId: recepcionId ?? null,

      action,

      previousValue: previousValue ?? null,
      newValue: newValue ?? null,
      difference: difference ?? null,

      userId: user.uid,
      userEmail: user.email,

      source,

      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    })
  } catch (error) {
    console.error("Error registrando stock log:", error)
  }
}
