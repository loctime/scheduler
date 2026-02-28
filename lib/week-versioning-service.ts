/**
 * @deprecated Usar `@/lib/week-versioning-service-fixed`.
 * Wrapper legado sin lógica propia para eliminar arquitectura dual en runtime.
 */
import {
  CreateVersionData,
  CreateVersionResult,
  CompleteWeekResult,
  WeekVersion,
} from "@/lib/types/week-versioning"
import { WeekVersioningService as FixedWeekVersioningService } from "@/lib/week-versioning-service-fixed"
import { Empleado } from "@/lib/types"

export class WeekVersioningService {
  static async createNewVersion(
    baseWeekId: string,
    versionData: Omit<CreateVersionData, "assignments" | "dayStatus" | "employeesSnapshot">
  ): Promise<CreateVersionResult> {
    console.warn("[DEPRECATED] week-versioning-service -> use week-versioning-service-fixed")
    return FixedWeekVersioningService.createNewVersion(baseWeekId, versionData)
  }

  static async completeCurrentWeek(
    baseWeekId: string,
    employees: Empleado[],
    shifts: any[],
    assignments: WeekVersion["assignments"],
    dayStatus: WeekVersion["dayStatus"],
    userId: string,
    userName: string
  ): Promise<CompleteWeekResult> {
    console.warn("[DEPRECATED] week-versioning-service -> use week-versioning-service-fixed")
    return FixedWeekVersioningService.completeCurrentWeek(
      baseWeekId,
      employees,
      shifts,
      assignments,
      dayStatus,
      userId,
      userName
    )
  }

  static async getCurrentVersion(baseWeekId: string): Promise<WeekVersion | null> {
    return FixedWeekVersioningService.getCurrentVersion(baseWeekId)
  }

  static async getAllVersions(baseWeekId: string): Promise<WeekVersion[]> {
    return FixedWeekVersioningService.getAllVersions(baseWeekId)
  }

  static async needsMigration(baseWeekId: string): Promise<boolean> {
    return FixedWeekVersioningService.needsMigration(baseWeekId)
  }

  static async migrateFromLegacy(baseWeekId: string, legacyWeekData: any): Promise<boolean> {
    return FixedWeekVersioningService.migrateFromLegacy(baseWeekId, legacyWeekData)
  }
}
