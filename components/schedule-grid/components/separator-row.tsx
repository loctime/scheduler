"use client"

import React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Separador } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Edit2, Trash2, AlertTriangle } from "lucide-react"
import { hexToRgba } from "../utils/schedule-grid-utils"

/** Mapa dayKey (yyyy-MM-dd) -> si ese día hay alerta de cobertura mínima en el sector */
export type CoverageAlertByDay = Record<string, boolean>

interface SeparatorRowProps {
  separator: Separador
  weekDays: Date[]
  editingSeparatorId: string | null
  separatorEditName: string
  separatorEditColor: string
  /** Valor en edición para cobertura mínima (solo mientras se edita). */
  separatorEditMinimoCobertura?: string
  onEditMinimoCoberturaChange?: (value: string) => void
  readonly: boolean
  onEditNameChange: (name: string) => void
  onEditColorChange: (color: string) => void
  onSave: () => void
  onCancel: () => void
  onEdit: (separator: Separador) => void
  onDelete: (separatorId: string) => void
  isFirstSeparator?: boolean
  onCloseSelector?: () => void
  /** Por día (yyyy-MM-dd), si hay alerta de cobertura mínima en ese día. */
  coverageAlertByDay?: CoverageAlertByDay
}

export function SeparatorRow({
  separator,
  weekDays,
  editingSeparatorId,
  separatorEditName,
  separatorEditColor,
  separatorEditMinimoCobertura,
  onEditMinimoCoberturaChange,
  readonly,
  onEditNameChange,
  onEditColorChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
  isFirstSeparator = false,
  onCloseSelector,
  coverageAlertByDay = {},
}: SeparatorRowProps) {
  const isEditing = editingSeparatorId === separator.id
  const separatorColor = separator.color

  return (
    <>
      <tr
        key={separator.id}
        className="group transition-colors"
        style={(() => {
          return separatorColor
            ? {
                borderBottomColor: separatorColor,
                borderBottomWidth: "2px",
                backgroundColor: hexToRgba(separatorColor, 0.1),
              }
            : {
                borderBottomColor: "#000000",
                borderBottomWidth: "2px",
                backgroundColor: "rgb(var(--muted) / 0.3)",
              }
        })()}
      >
        <td 
          colSpan={weekDays.length + 1} 
          className="px-4 py-0.5"
          onClick={(e) => {
            // No cerrar si se está editando o si se hace click en botones/inputs
            const target = e.target as HTMLElement
            const isInteractive = target.closest('button') || target.closest('input')
            if (onCloseSelector && !isEditing && !isInteractive) {
              e.stopPropagation()
              onCloseSelector()
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="h-px flex-1"
                style={{
                  backgroundColor: separatorColor || "rgb(var(--border))",
                }}
              ></div>
              {isEditing ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Input
                    value={separatorEditName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onSave()
                      } else if (e.key === "Escape") {
                        onCancel()
                      }
                    }}
                    className="h-6 text-xs font-semibold text-center min-w-[100px]"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Input
                    type="color"
                    value={separatorEditColor || "#3b82f6"}
                    onChange={(e) => onEditColorChange(e.target.value)}
                    className="h-6 w-10 p-0.5 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {onEditMinimoCoberturaChange && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Cobertura mín.:</span>
                      <Input
                        type="number"
                        min={0}
                        max={99}
                        value={separatorEditMinimoCobertura ?? ""}
                        onChange={(e) => onEditMinimoCoberturaChange(e.target.value)}
                        placeholder="1"
                        className="h-6 w-12 text-xs text-center p-1"
                      />
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onSave}>
                    <Check className="h-3 w-3" />
                  </Button>
                  {!readonly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        onDelete(separator.id)
                        onCancel()
                      }}
                      title="Eliminar separador"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ) : (
                <h3
                  className="text-xs font-semibold text-foreground uppercase tracking-wide cursor-pointer hover:text-primary transition-colors"
                  onClick={() => !readonly && onEdit(separator)}
                >
                  {separator.nombre}
                </h3>
              )}
              <div
                className="h-px flex-1"
                style={{
                  backgroundColor: separatorColor || "rgb(var(--border))",
                }}
              ></div>
            </div>
            {!readonly && !isEditing && (
              <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-accent"
                  onClick={() => onEdit(separator)}
                  title="Editar separador"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(separator.id)}
                  title="Eliminar separador"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </td>
      </tr>
      {!isFirstSeparator && (
        <tr
          className="transition-colors"
          style={(() => {
            return separatorColor
              ? {
                  borderBottomColor: separatorColor,
                  borderBottomWidth: "2px",
                  backgroundColor: hexToRgba(separatorColor, 0.1),
                }
              : {
                  borderBottomColor: "#000000",
                  borderBottomWidth: "2px",
                  backgroundColor: "rgb(var(--muted) / 0.3)",
                }
          })()}
        >
          <td
            className="border-r-2 border-black px-4 py-0.5"
            style={
              separatorColor
                ? { backgroundColor: hexToRgba(separatorColor, 0.1) }
                : { backgroundColor: "rgb(var(--muted) / 0.3)" }
            }
            onClick={(e) => {
              if (onCloseSelector) {
                e.stopPropagation()
                onCloseSelector()
              }
            }}
          ></td>
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd")
            const hasAlert = coverageAlertByDay[dayKey] === true
            return (
              <td
                key={day.toISOString()}
                className="border-r-2 border-black px-2 py-0.5 text-center last:border-r-0 relative"
                style={
                  separatorColor
                    ? { backgroundColor: hexToRgba(separatorColor, 0.1) }
                    : { backgroundColor: "rgb(var(--muted) / 0.3)" }
                }
                onClick={(e) => {
                  if (onCloseSelector) {
                    e.stopPropagation()
                    onCloseSelector()
                  }
                }}
              >
                {hasAlert && (
                  <span
                    className="absolute top-0.5 right-1 flex items-center justify-center text-amber-600"
                    title="Cobertura mínima no alcanzada en algún momento del día"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="text-xs font-semibold text-muted-foreground capitalize">
                  {format(day, "EEEE", { locale: es })}
                </span>
              </td>
            )
          })}
        </tr>
      )}
    </>
  )
}

