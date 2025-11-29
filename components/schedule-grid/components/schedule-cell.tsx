"use client"

import React from "react"
import type { CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import { Check, RotateCcw, Undo2 } from "lucide-react"
import { ShiftAssignment, Turno, MedioTurno } from "@/lib/types"
import { CellAssignments } from "./cell-assignments"
import { InlineShiftSelector } from "./inline-shift-selector"

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
  quickShifts: Turno[]
  mediosTurnos?: MedioTurno[]
  onQuickAssignments?: (assignments: ShiftAssignment[]) => void
  readonly?: boolean
  hasCellHistory?: boolean
  onCellUndo?: () => void
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
  quickShifts,
  mediosTurnos,
  onQuickAssignments,
  readonly = false,
  hasCellHistory = false,
  onCellUndo,
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <td
          className={`border-r-2 border-black px-4 py-4 last:border-r-0 relative group ${
            isClickable ? `cursor-pointer transition-all ${hoverClass} active:brightness-90` : ""
          } ${selectedClass}`}
          style={backgroundStyle}
          onClick={() => onCellClick(date, employeeId)}
        >
          {/* Botón pequeño de deshacer en celda (arriba a la izquierda) */}
          {!readonly && hasCellHistory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCellUndo?.()
              }}
              className="absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-primary/90 text-primary-foreground opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100 hover:bg-primary shadow-sm"
              title="Deshacer cambio en esta celda"
              aria-label="Deshacer cambio en esta celda"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
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
        {isSelected && isClickable && onQuickAssignments ? (
          <InlineShiftSelector
            shifts={quickShifts}
            mediosTurnos={mediosTurnos}
            onSelectAssignments={onQuickAssignments}
          />
        ) : (
          <CellAssignments assignments={assignments} getShiftInfo={getShiftInfo} />
        )}
      </div>
    </td>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {!readonly && (
          <>
            <ContextMenuItem onClick={() => onCellClick(date, employeeId)}>
              Editar turno
            </ContextMenuItem>
            {hasCellHistory && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onCellUndo?.()}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Deshacer cambio en esta celda
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

