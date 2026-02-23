export interface Task {
  id: string
  ownerId: string
  title: string
  description?: string
  detailedContent?: string
  instructions?: string
  employeeIds?: string[]
  daysOfWeek?: number[]
  active: boolean
  createdAt: any
}
