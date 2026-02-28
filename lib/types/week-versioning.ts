// Sistema de Versionado de Semanas - Arquitectura Inmutable y Escalable

import { ShiftAssignment } from "@/lib/types"

// TIPOS PRINCIPALES - CONSOLIDADOS Y TIPOGRÁFICAMENTE CORRECTOS

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

// VERSIÓN INDIVIDUAL - DOCUMENTO EN SUBCOLECCIÓN
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

// DOCUMENTO PRINCIPAL - SIN VERSIONES EMBEBIDAS
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

// DATOS PARA CREAR VERSIÓN - SIN ANY
export interface CreateVersionData {
  isCompleted: boolean
  assignments?: WeekAssignments
  dayStatus?: WeekDayStatus
  employeesSnapshot: EmployeeSnapshot[]
  createdBy?: string
  createdByName?: string
}

// RESULTADOS DE OPERACIONES - TIPOGRÁFICAMENTE CORRECTOS
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

// ESTADO PARA UI - SIN ANY
export interface WeekVersionState {
  currentVersion: WeekVersion | null
  availableVersions: WeekVersion[]
  isLoading: boolean
  isCreatingNewVersion: boolean
  error?: string
}

// VALIDACIONES DE NEGOCIO
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
}
