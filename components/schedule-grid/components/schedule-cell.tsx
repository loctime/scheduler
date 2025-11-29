"use client"

import React from "react"
import type { CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Check } from "lucide-react"
import { ShiftAssignment, Turno } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"

interface ScheduleCellProps {
  date: string
  employeeId: string
  assignments: ShiftAssignment[]
  backgroundStyle?: CSSProperties
  isSelected: boolean
  isClickable: boolean
  getShiftInfo: (shiftId: string) => Turno | undefined
  onCellClick: (date: string, employeeId: string) => void
  showExtraActions: boolean
  extraMenuOpenKey: string | null
  cellKey: string
  hasExtraBefore: boolean
  hasExtraAfter: boolean
  onToggleExtra: (type: "before" | "after") => void
  onExtraMenuOpenChange: (open: boolean) => void
}

export function ScheduleCell({
  date,
  employeeId,
  assignments,
  backgroundStyle,
  isSelected,
  isClickable,
  getShiftInfo,
  onCellClick,
  showExtraActions,
  extraMenuOpenKey,
  cellKey,
  hasExtraBefore,
  hasExtraAfter,
  onToggleExtra,
  onExtraMenuOpenChange,
}: ScheduleCellProps) {
  const hasBackgroundStyle = !!backgroundStyle
  const hoverClass = hasBackgroundStyle
    ? isClickable
      ? "hover:brightness-95"
      : ""
    : isClickable
    ? "hover:bg-muted/50"
    : ""
  const selectedClass = hasBackgroundStyle ? "ring-2 ring-primary/30" : isSelected ? "bg-primary/10" : ""

  return (
    <td
      className={`border-r border-border px-4 py-4 last:border-r-0 relative ${
        isClickable ? `cursor-pointer transition-all ${hoverClass} active:brightness-90` : ""
      } ${selectedClass}`}
      style={backgroundStyle}
      onClick={() => onCellClick(date, employeeId)}
    >
      {showExtraActions && (
        <div className="absolute -top-1 right-1" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu open={extraMenuOpenKey === cellKey} onOpenChange={onExtraMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-6 px-2 text-xs">
                +Extra
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onToggleExtra("before")
                  onExtraMenuOpenChange(false)
                }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="flex-1">+30 min antes</span>
                {hasExtraBefore && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  onToggleExtra("after")
                  onExtraMenuOpenChange(false)
                }}
                className="flex items-center gap-2 text-xs"
              >
                <span className="flex-1">+30 min después</span>
                {hasExtraAfter && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <CellAssignments assignments={assignments} getShiftInfo={getShiftInfo} />
      </div>
    </td>
  )
}

