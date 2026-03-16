export type TaskType = "daily" | "weekly" | "specific"

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
  active: boolean
  createdAt: any
}
