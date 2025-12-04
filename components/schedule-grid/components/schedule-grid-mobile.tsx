"use client"

import React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Empleado, Turno, ShiftAssignment, MedioTurno } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"
import { InlineShiftSelector } from "./inline-shift-selector"
import { GripVertical, Plus, RotateCcw, Lock } from "lucide-react"
import { getDay, parseISO } from "date-fns"
import type { EmployeeMonthlyStats } from "../index"
import { formatStatValue } from "../utils/schedule-grid-utils"

interface ScheduleGridMobileProps {
  weekDays: Date[]
  employees: Empleado[]
  weekDaysData: Array<{
    date: Date
    dateStr: string
    dayName: string
    dayNumber: string
  }>
  getEmployeeAssignments: (employeeId: string, date: string) => ShiftAssignment[]
  getCellBackgroundStyle: (employeeId: string, date: string) => React.CSSProperties | undefined
  getShiftInfo: (shiftId: string) => Turno | undefined
  selectedCell: { date: string; employeeId: string } | null
  isClickable: boolean
  onCellClick: (date: string, employeeId: string) => void
  onQuickAssignments?: (date: string, employeeId: string, assignments: ShiftAssignment[]) => void
  readonly?: boolean
  employeeStats?: Record<string, EmployeeMonthlyStats>
  shifts: Turno[]
  mediosTurnos?: MedioTurno[]
  cellUndoHistory: Map<string, ShiftAssignment[]>
  handleCellUndo: (date: string, employeeId: string) => void
  getSuggestion?: (employeeId: string, dayOfWeek: number) => any
  isManuallyFixed?: (employeeId: string, dayOfWeek: number) => boolean
  onToggleFixed?: (date: string, employeeId: string, dayOfWeek: number) => void
}

export function ScheduleGridMobile({
  weekDays,
  employees,
  weekDaysData,
  getEmployeeAssignments,
  getCellBackgroundStyle,
  getShiftInfo,
  selectedCell,
  isClickable,
  onCellClick,
  onQuickAssignments,
  readonly = false,
  employeeStats,
  shifts,
  mediosTurnos,
  cellUndoHistory,
  handleCellUndo,
  getSuggestion,
  isManuallyFixed,
  onToggleFixed,
}: ScheduleGridMobileProps) {
  return (
    <div className="space-y-4">
      {employees.map((employee) => {
        const stats = employeeStats?.[employee.id]
        const isSelected = selectedCell?.employeeId === employee.id

        return (
          <Card key={employee.id} className="overflow-hidden border border-border bg-card">
            {/* Employee Header */}
            <div className="border-b border-border bg-muted/30 px-4 py-3">
              <div className="flex items-start gap-2">
                {!readonly && (
                  <GripVertical className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate">{employee.name}</h3>
                  {stats && (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Francos:</span>
                        <span>{formatStatValue(stats.francos)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">H. extra/sem:</span>
                        <span>{formatStatValue(stats.horasExtrasSemana)}h</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">H. extra/mes:</span>
                        <span>{formatStatValue(stats.horasExtrasMes)}h</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Week Days */}
            <div>
              {weekDaysData.map((dayData) => {
                const { date, dateStr, dayName, dayNumber } = dayData
                const assignments = getEmployeeAssignments(employee.id, dateStr)
                const backgroundStyle = getCellBackgroundStyle(employee.id, dateStr)
                const isCellSelected = selectedCell?.date === dateStr && selectedCell?.employeeId === employee.id
                const dayOfWeek = getDay(parseISO(dateStr))
                const suggestion = getSuggestion ? getSuggestion(employee.id, dayOfWeek) : null
                const hasFixedSchedule = suggestion?.isFixed === true
                const isManuallyFixedCell = isManuallyFixed ? isManuallyFixed(employee.id, dayOfWeek) : false

                const undoCellKey = `${dateStr}-${employee.id}`
                const hasCellHistory = cellUndoHistory.has(undoCellKey)

                return (
                  <div
                    key={dateStr}
                    className={`px-4 py-3 transition-colors border border-border ${
                      isClickable ? "cursor-pointer hover:bg-muted/50 active:bg-muted" : ""
                    } ${isCellSelected ? "bg-primary/10" : ""}`}
                    style={backgroundStyle}
                    onClick={() => onCellClick(dateStr, employee.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Day Info */}
                      <div className="shrink-0 w-16 sm:w-20">
                        <div className="text-xs sm:text-sm font-bold text-foreground capitalize">
                          {dayName}
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">
                          {dayNumber}
                        </div>
                      </div>

                      {/* Assignments */}
                      <div className="flex-1 min-w-0">
                        {isCellSelected && isClickable && onQuickAssignments ? (
                          <InlineShiftSelector
                            shifts={shifts}
                            mediosTurnos={mediosTurnos}
                            onSelectAssignments={(assignments) =>
                              onQuickAssignments(dateStr, employee.id, assignments)
                            }
                          />
                        ) : (
                          <div className="text-xs sm:text-sm">
                            <CellAssignments
                              assignments={assignments}
                              getShiftInfo={getShiftInfo}
                            />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {!readonly && (
                        <div className="flex items-center gap-1 shrink-0">
                          {hasCellHistory && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCellUndo(dateStr, employee.id)
                              }}
                              title="Deshacer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isManuallyFixed && onToggleFixed && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                isManuallyFixedCell
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation()
                                onToggleFixed(dateStr, employee.id, dayOfWeek)
                              }}
                              title={isManuallyFixedCell ? "Desmarcar fijo" : "Marcar fijo"}
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

