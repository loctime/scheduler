export type TaskType = "daily" | "weekly" | "specific" | "reference"
export type TaskShift = "morning" | "afternoon" | "both"

export interface Task {
  id: string
  ownerId: string
  title: string
  description?: string
  detailedContent?: string
  instructions?: string
  employeeIds?: string[]
  daysOfWeek?: number[]
  taskType?: TaskType
  specificDate?: string // YYYY-MM-DD
  shift?: TaskShift // Turno: mañana, tarde o ambos
  active: boolean
  createdAt: any
}
