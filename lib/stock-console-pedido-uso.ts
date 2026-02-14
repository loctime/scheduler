/**
 * Persiste el uso de pedidos en Stock Console por ownerId.
 * Ordenamos los pedidos según cuáles usa más cada usuario/empresa.
 */

const STORAGE_PREFIX = "stock-console-pedido-uso"

export interface PedidoUsage {
  count: number
  lastUsed: number
}

function getStorageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}-${ownerId}`
}

export function getPedidoUsage(ownerId: string): Record<string, PedidoUsage> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(getStorageKey(ownerId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PedidoUsage>
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function recordPedidoUsage(ownerId: string, pedidoId: string): void {
  if (typeof window === "undefined") return
  try {
    const usage = getPedidoUsage(ownerId)
    const current = usage[pedidoId] ?? { count: 0, lastUsed: 0 }
    usage[pedidoId] = {
      count: current.count + 1,
      lastUsed: Date.now(),
    }
    localStorage.setItem(getStorageKey(ownerId), JSON.stringify(usage))
  } catch {
    // Ignorar errores de localStorage
  }
}
