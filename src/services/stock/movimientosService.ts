import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  addDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { 
  MovimientoInput, 
  ConfirmarMovimientoResult,
  MovimientoStock,
  MovimientoStockTipo 
} from "@/src/domain/stock/types"

const COLLECTIONS = {
  STOCK_MOVEMENTS: "apps/horarios/stock_movimientos",
  PRODUCTS: "apps/horarios/products",
} as const

/**
 * Obtiene el stock actual de un producto desde Firestore
 */
async function getStockActual(productoId: string): Promise<number> {
  if (!db) throw new Error("Firestore no está inicializado")
  
  const productRef = doc(db, COLLECTIONS.PRODUCTS, productoId)
  
  return await runTransaction(db, async (transaction) => {
    const productDoc = await transaction.get(productRef)
    if (!productDoc.exists()) {
      throw new Error(`Producto ${productoId} no encontrado`)
    }
    return productDoc.data().stockActual || 0
  })
}

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
  userId: string
): Promise<ConfirmarMovimientoResult> {
  if (!db) {
    return {
      ok: false,
      error: "Firestore no está inicializado",
    }
  }

  try {
    const movimientosGuardados: MovimientoStock[] = []
    const stockActualizado: Record<string, number> = {}

    const transactionResult = await runTransaction(db!, async (transaction) => {
      // PRIMERO: Leer todos los productos necesarios
      const productosRefs = movimientos.map(m => doc(db!, COLLECTIONS.PRODUCTS, m.productoId))
      const productosDocs = await Promise.all(
        productosRefs.map(ref => transaction.get(ref))
      )

      // Validar que todos los productos existan
      const productosData = productosDocs.map((doc, index) => {
        if (!doc.exists()) {
          throw new Error(`Producto ${movimientos[index].productoId} no encontrado`)
        }
        return {
          doc,
          stockActual: doc.data().stockActual || 0,
          movimiento: movimientos[index]
        }
      })

      // SEGUNDO: Validar stock negativo para todos los egresos
      for (const { stockActual, movimiento } of productosData) {
        const validacion = validarStockNegativo(
          stockActual, 
          movimiento.cantidad, 
          movimiento.tipo
        )
        if (!validacion.ok) {
          throw new Error(validacion.error)
        }
      }

      // TERCERO: Escribir todos los cambios
      for (const { doc: productDoc, stockActual, movimiento } of productosData) {
        // Calcular nuevo stock
        const nuevoStock = movimiento.tipo === "INGRESO" 
          ? stockActual + movimiento.cantidad
          : stockActual - movimiento.cantidad

        // Actualizar stock del producto
        transaction.update(productDoc.ref, {
          stockActual: nuevoStock,
          updatedAt: serverTimestamp(),
        })

        // Crear registro del movimiento
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
          pedidoId: movimiento.pedidoId,
          origen: "stock_console",
        }

        // Para crear el documento dentro de la transacción, necesitamos un nuevo docRef
        const movimientoRef = doc(collection(db!, COLLECTIONS.STOCK_MOVEMENTS))
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
