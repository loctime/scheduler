// Sistema de Versionado de Semanas - Arquitectura Inmutable Profesional
// Reemplaza completamente el modelo simple isCompleted/weekSnapshot

import { ShiftAssignment, Empleado } from "@/lib/types"

// ========================================
// TIPOS PRINCIPALES DEL NUEVO SISTEMA
// ========================================

export type AssignmentStatus = "normal" | "franco" | "medio_franco"

export interface WeekAssignments {
  [date: string]: {
    [empleadoId: string]: ShiftAssignment[]
  }
}

export interface WeekDayStatus {
  [date: string]: {
    [empleadoId: string]: AssignmentStatus
  }
}

export interface EmployeeSnapshot {
  id: string
  name: string
}

export interface ShiftSnapshot {
  id: string
  name: string
  color?: string
  startTime?: string
  endTime?: string
  startTime2?: string
  endTime2?: string
  colorPrimeraFranja?: string
  colorSegundaFranja?: string
}

export interface WeekSnapshotMeta {
  capturedAt?: any
  shifts?: ShiftSnapshot[]
  separadores?: any[]
  ordenEmpleados?: string[]
}

// ========================================
// VERSIÓN INDIVIDUAL - INMUTABLE
// ========================================

export interface WeekVersion {
  versionNumber: number
  isCompleted: boolean
  assignments: WeekAssignments
  dayStatus: WeekDayStatus
  employeesSnapshot: EmployeeSnapshot[]
  createdAt: any // Firestore Timestamp
  createdBy?: string
  createdByName?: string
  previousVersionNumber?: number
  snapshotMeta?: WeekSnapshotMeta
}

// ========================================
// DOCUMENTO PRINCIPAL - SIN VERSIONES EMBEBIDAS
// ========================================

export interface WeekDocument {
  id: string // baseWeekId
  baseWeekId: string // Mismo valor que id para consistencia
  currentVersionNumber: number
  status: "draft" | "completed"
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
  ownerId: string
  weekStart: string // Formato YYYY-MM-DD
  semanaInicio: string // Formato legible
  semanaFin: string // Formato legible
  nombre: string
}

// ========================================
// DATOS PARA CREAR VERSIÓN
// ========================================

export interface CreateVersionData {
  isCompleted: boolean
  assignments?: WeekAssignments
  dayStatus?: WeekDayStatus
  employeesSnapshot: EmployeeSnapshot[]
  createdBy?: string
  createdByName?: string
}

// ========================================
// RESULTADOS DE OPERACIONES
// ========================================

export interface CreateVersionResult {
  success: boolean
  newVersionNumber: number
  error?: string
}

export interface CompleteWeekResult {
  success: boolean
  completedVersionNumber: number
  error?: string
}

export interface EditWeekResult {
  success: boolean
  newVersionNumber: number
  error?: string
}

// ========================================
// ESTADO PARA UI
// ========================================

export interface WeekVersionState {
  currentVersion: WeekVersion | null
  availableVersions: WeekVersion[]
  isLoading: boolean
  isCreatingNewVersion: boolean
  error?: string
}

// ========================================
// REGLAS DE NEGOCIO - VALIDACIONES
// ========================================

export class WeekVersioningRules {
  static readonly MAX_VERSIONS_PER_WEEK = 100
  static readonly MAX_VERSION_NUMBER = 999999
  
  static canEditVersion(version: WeekVersion): boolean {
    return !version.isCompleted
  }
  
  static canCreateNewVersion(status: "draft" | "completed"): boolean {
    return true // Siempre se puede crear nueva versión
  }
  
  static validateVersionNumber(versionNumber: number): boolean {
    return versionNumber > 0 && versionNumber <= this.MAX_VERSION_NUMBER
  }
  
  static validateWeekVersionIntegrity(weekDoc: WeekDocument, currentVersion: WeekVersion): boolean {
    return weekDoc.currentVersionNumber === currentVersion.versionNumber
  }
  
  static isVersionImmutable(version: WeekVersion): boolean {
    return version.isCompleted
  }
}

// ========================================
// TIPOS PARA MIGRACIÓN
// ========================================

export interface LegacyWeekData {
  id: string
  isCompleted?: boolean
  completada?: boolean
  assignments?: WeekAssignments
  dayStatus?: WeekDayStatus
  employeesSnapshot?: EmployeeSnapshot[]
  weekSnapshot?: {
    assignments?: WeekAssignments
    dayStatus?: WeekDayStatus
    employees?: EmployeeSnapshot[]
    capturedAt?: any
    shifts?: ShiftSnapshot[]
    separadores?: any[]
    ordenEmpleados?: string[]
  }
  createdAt?: any
  createdBy?: string
  createdByName?: string
  ownerId: string
  weekStart: string
  semanaInicio: string
  semanaFin: string
  nombre: string
}

export interface MigrationResult {
  success: boolean
  migratedWeeks: number
  failedWeeks: number
  errors: string[]
}

// ========================================
// TIPOS PARA DIÁLOGO DE CONFIRMACIÓN
// ========================================

export interface CreateVersionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (createNewVersion: boolean) => void
  weekStatus: "draft" | "completed"
  currentVersionNumber: number
  isLoading?: boolean
}

// ========================================
// TIPOS PARA HOOKS REFACTORIZADOS
// ========================================

export interface UseWeekVersioningReturn {
  // Estado actual
  currentVersion: WeekVersion | null
  weekDocument: WeekDocument | null
  availableVersions: WeekVersion[]
  
  // Estados de loading
  isLoading: boolean
  isCreatingVersion: boolean
  
  // Acciones principales
  createNewVersion: (isCompleted: boolean) => Promise<CreateVersionResult>
  completeWeek: (
    employees: Empleado[],
    shifts: any[],
    assignments: WeekVersion["assignments"],
    dayStatus: WeekVersion["dayStatus"]
  ) => Promise<CompleteWeekResult>
  editWeek: () => Promise<EditWeekResult>
  
  // Utilidades
  refreshVersions: () => Promise<void>
  error: string | null
}

export interface UseWeekDataReturn {
  weekData: WeekVersion | null
  weekDocument: WeekDocument | null
  isLoading: boolean
  error: string | null
  saveWeekData: (data: Partial<WeekVersion>) => Promise<void>
  refreshWeekData: () => Promise<void>
  createNewVersionForEdit: () => Promise<EditWeekResult>
}
