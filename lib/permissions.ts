export type UserRole = "operador" | "admin" | "delivery"

export type UserAction =
  | "ver_dashboard"
  | "ver_pedidos"
  | "crear_pedido"
  | "editar_pedido"
  | "recibir_pedido"
  | "ver_stock"
  | "editar_stock"
  | "ver_productos"
  | "editar_producto"
  | "ver_admin"
  | "ver_asignaciones_delivery"
  | "actualizar_estado_delivery"

export interface PermissionUser {
  uid?: string
  role?: UserRole
  locationId?: string | null
}

export interface PermissionContext {
  assignedUserId?: string | null
  locationId?: string | null
}

export function isAssigned(user: PermissionUser | null, context?: PermissionContext) {
  if (!context?.assignedUserId) return true
  return !!user?.uid && context.assignedUserId === user.uid
}

export function canUser(
  user: PermissionUser | null | undefined,
  action: UserAction,
  context?: PermissionContext
) {
  if (!user?.role) return false

  if (action === "ver_dashboard") {
    return true
  }

  if (user.role === "admin") {
    // Admin con override operativo
    return true
  }

  if (user.role === "operador") {
    if (action === "ver_admin") return false
    return true
  }

  if (user.role === "delivery") {
    if (action === "ver_asignaciones_delivery" || action === "actualizar_estado_delivery") {
      return true
    }
    if (action === "ver_pedidos") {
      return isAssigned(user, context)
    }
    return false
  }

  return false
}

