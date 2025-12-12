// ... existing code ...

export interface InvitacionLink {
  id: string
  token: string // Token único para el link
  ownerId: string // ID del usuario que creó el link
  activo: boolean
  usado: boolean
  usadoPor?: string // ID del usuario que usó el link
  usadoPorEmail?: string // Email del usuario que usó el link
  usadoEn?: any // Timestamp de cuando se usó
  createdAt?: any
  expiresAt?: any // Opcional: fecha de expiración
  role?: "branch" | "factory" | "admin" | "invited" | "manager" // Rol que se asignará al usuario que use el link
  grupoId?: string // ID del grupo al que pertenecerá el usuario (para links creados por manager)
}

export interface Group {
  id: string
  nombre: string // Nombre del grupo (ej: "Grupo Norte", "Grupo Sur")
  managerId: string // ID del usuario gerente del grupo
  managerEmail?: string // Email del gerente (para referencia)
  userIds: string[] // IDs de usuarios del grupo (branch, factory)
  createdAt?: any
  updatedAt?: any
}
