import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  addDoc,
} from "firebase/firestore"
import { db, COLLECTIONS } from "@/lib/firebase"
import { stockUbicacionRef } from "@/lib/stock-ubicaciones-service"
import type { 
  MovimientoInput, 
  ConfirmarMovimientoResult,
  MovimientoStock,
  MovimientoStockTipo 
} from "@/src/domain/stock/types"

/**
 * Valida que un egreso no genere stock negativo
 */
function validarStockNegativo(
  stockActual: number, 
  cantidad: number, 
  tipo: MovimientoStockTipo
): { ok: true } | { ok: false; error: string } {
  if (tipo === "EGRESO" && stockActual < cantidad) {
    return { 
      ok: false, 
      error: `Stock insuficiente. Actual: ${stockActual}, requerido: ${cantidad}` 
    }
  }
  return { ok: true }
}

/**
 * Confirma múltiples movimientos de stock en una transacción
 */
export async function confirmarMovimientos(
  movimientos: MovimientoInput[],
  ownerId: string,
  userId: string,
  locationId: string
): Promise<ConfirmarMovimientoResult> {
  if (!db) {
    return {
      ok: false,
      error: "Firestore no está inicializado",
    }
  }

  if (!locationId) {
    return {
      ok: false,
      error: "Falta la ubicación (locationId) para actualizar el stock",
    }
  }

  const firestore = db

  try {
    const movimientosGuardados: MovimientoStock[] = []
    const stockActualizado: Record<string, number> = {}

    const transactionResult = await runTransaction(firestore, async (transaction) => {
      const stockRefs = movimientos.map((m) =>
        stockUbicacionRef(firestore, ownerId, m.productoId, locationId)
      )
      const stockDocs = await Promise.all(stockRefs.map((ref) => transaction.get(ref)))

      const filas = stockDocs.map((snap, index) => {
        if (!snap.exists()) {
          throw new Error(
            `Producto ${movimientos[index].productoId} sin stock en esta ubicación. Activá el producto en «Mi stock».`
          )
        }
        const data = snap.data()
        const stockActual = Math.max(0, Math.floor(Number(data.stockActual) || 0))
        return { ref: snap.ref, stockActual, movimiento: movimientos[index] }
      })

      for (const { stockActual, movimiento } of filas) {
        const validacion = validarStockNegativo(stockActual, movimiento.cantidad, movimiento.tipo)
        if (!validacion.ok) {
          throw new Error(validacion.error)
        }
      }

      for (const { ref, stockActual, movimiento } of filas) {
        const nuevoStock =
          movimiento.tipo === "INGRESO"
            ? stockActual + movimiento.cantidad
            : stockActual - movimiento.cantidad

        transaction.update(ref, {
          stockActual: nuevoStock,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        })

        const movimientoData: Omit<MovimientoStock, "id"> = {
          tipo: movimiento.tipo,
          productoId: movimiento.productoId,
          productoNombre: movimiento.productoNombre,
          cantidad: movimiento.cantidad,
          stockAntes: stockActual,
          stockDespues: nuevoStock,
          ownerId,
          userId,
          fecha: new Date(),
          origen: "stock_console",
          ...(movimiento.pedidoId ? { pedidoId: movimiento.pedidoId } : {}),
        }

        const movimientoRef = doc(collection(firestore, COLLECTIONS.STOCK_MOVIMIENTOS))
        transaction.set(movimientoRef, {
          ...movimientoData,
          createdAt: serverTimestamp(),
        })

        const movimientoGuardado: MovimientoStock = {
          id: movimientoRef.id,
          ...movimientoData,
        }

        movimientosGuardados.push(movimientoGuardado)
        stockActualizado[movimiento.productoId] = nuevoStock
      }

      return { movimientosGuardados, stockActualizado }
    })

    return {
      ok: true,
      movimientos: transactionResult.movimientosGuardados,
      stockActualizado: transactionResult.stockActualizado,
    }

  } catch (error: any) {
    console.error("Error en confirmarMovimientos:", error)
    return {
      ok: false,
      error: error.message || "Error al procesar movimientos",
    }
  }
}

/**
 * Obtiene el historial de movimientos de un usuario
 */
export async function getMovimientosHistorial(
  userId: string,
  limit: number = 50
): Promise<MovimientoStock[]> {
  // Implementación futura para historial
  return []
}
