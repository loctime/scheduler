/**
 * Helpers de remito de envío usados solo por el flujo de enlace público (`/pedido-publico/[id]`).
 * Escriben en la colección legacy `remitos` (misma ruta que antes vía getCollectionPath).
 */
import type { Remito, Pedido, Producto } from "./types"
import { getCollectionPath } from "./firebase"

const LEGACY_REMITOS_COLLECTION = getCollectionPath("remitos")

function normalizarNombrePedido(nombre: string): string {
  if (!nombre || typeof nombre !== "string") {
    return "PEDIDO"
  }
  const normalizado = nombre
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 10)
  return normalizado || "PEDIDO"
}

/** Número único por prefijo de pedido (VERDULERIA-001, …). */
export async function generarNumeroRemito(
  db: unknown,
  _collections: unknown,
  nombrePedido: string
): Promise<string> {
  try {
    const { collection, query, orderBy, limit, getDocs, where } = await import("firebase/firestore")
    const prefijo = normalizarNombrePedido(nombrePedido)
    const remitosRef = collection(db as any, LEGACY_REMITOS_COLLECTION)
    const q = query(
      remitosRef,
      where("numero", ">=", `${prefijo}-000`),
      where("numero", "<", `${prefijo}-999`),
      orderBy("numero", "desc"),
      limit(1)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      return `${prefijo}-001`
    }
    const ultimoNumero = snapshot.docs[0].data().numero
    const partes = ultimoNumero.split("-")
    if (partes.length === 2 && partes[0] === prefijo) {
      const numero = parseInt(partes[1], 10) + 1
      return `${prefijo}-${String(numero).padStart(3, "0")}`
    }
    return `${prefijo}-001`
  } catch {
    const prefijo = normalizarNombrePedido(nombrePedido)
    const timestamp = Date.now()
    return `${prefijo}-${String(timestamp).slice(-6)}`
  }
}

export function crearRemitoEnvioDesdeDisponibles(
  pedido: Pedido,
  productos: Producto[],
  productosDisponibles: Record<
    string,
    {
      disponible: boolean
      cantidadEnviada?: number
      observaciones?: string
    }
  >
): Omit<Remito, "id" | "numero" | "createdAt"> {
  const productosRemito = productos
    .filter((p) => {
      const disponible = productosDisponibles[p.id]
      return (
        disponible?.disponible === true ||
        !!(disponible?.observaciones && disponible.observaciones.trim().length > 0)
      )
    })
    .map((p) => {
      const disponible = productosDisponibles[p.id]
      const cantidadPedida = (p as { cantidadPedida?: number }).cantidadPedida || p.stockMinimo || 0
      const productoRemito: {
        productoId: string
        productoNombre: string
        cantidad: number
        cantidadPedida: number
        cantidadEnviada: number
        observaciones?: string
      } = {
        productoId: p.id,
        productoNombre: p.nombre,
        cantidad: disponible?.cantidadEnviada || 0,
        cantidadPedida,
        cantidadEnviada: disponible?.cantidadEnviada || 0,
      }
      if (disponible?.observaciones && disponible.observaciones.trim().length > 0) {
        productoRemito.observaciones = disponible.observaciones.trim()
      }
      return productoRemito
    })

  const observacionesGenerales = productos
    .map((p) => {
      const disponible = productosDisponibles[p.id]
      if (disponible?.observaciones && disponible.observaciones.trim().length > 0) {
        const productoEnRemito = productosRemito.find((pr) => pr.productoId === p.id)
        if (!productoEnRemito || !productoEnRemito.observaciones) {
          return `${p.nombre}: ${disponible.observaciones}`
        }
      }
      return null
    })
    .filter(Boolean)
    .join("\n")

  const remitoData: Record<string, unknown> = {
    pedidoId: pedido.id,
    tipo: "envio",
    fecha: new Date(),
    desde: pedido.origenDefault || "FABRICA",
    hacia: pedido.destinoDefault || "LOCAL",
    productos: productosRemito,
    userId: pedido.userId,
    ownerId: pedido.userId,
  }
  if (observacionesGenerales && observacionesGenerales.trim().length > 0) {
    remitoData.observaciones = observacionesGenerales
  }
  return remitoData as Omit<Remito, "id" | "numero" | "createdAt">
}
