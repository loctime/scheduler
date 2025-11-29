"use client"

import React from "react"
import { Separador } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Edit2, Trash2 } from "lucide-react"
import { hexToRgba } from "../utils/schedule-grid-utils"

interface SeparatorRowProps {
  separator: Separador
  weekDaysCount: number
  editingSeparatorId: string | null
  separatorEditName: string
  separatorEditColor: string
  readonly: boolean
  onEditNameChange: (name: string) => void
  onEditColorChange: (color: string) => void
  onSave: () => void
  onCancel: () => void
  onEdit: (separator: Separador) => void
  onDelete: (separatorId: string) => void
}

export function SeparatorRow({
  separator,
  weekDaysCount,
  editingSeparatorId,
  separatorEditName,
  separatorEditColor,
  readonly,
  onEditNameChange,
  onEditColorChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
}: SeparatorRowProps) {
  const isEditing = editingSeparatorId === separator.id

  return (
    <tr
      key={separator.id}
      className="group transition-colors"
      style={(() => {
        const separatorColor = separator.color
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
      <td colSpan={weekDaysCount + 1} className="px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div
              className="h-px flex-1"
              style={{
                backgroundColor: separator.color || "rgb(var(--border))",
              }}
            ></div>
            {isEditing ? (
              <div className="flex items-center gap-2">
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
                  className="h-7 text-sm font-semibold text-center min-w-[120px]"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <Input
                  type="color"
                  value={separatorEditColor || "#3b82f6"}
                  onChange={(e) => onEditColorChange(e.target.value)}
                  className="h-7 w-12 p-1 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onSave}>
                  <Check className="h-4 w-4" />
                </Button>
                {!readonly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      onDelete(separator.id)
                      onCancel()
                    }}
                    title="Eliminar separador"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <h3
                className="text-sm font-semibold text-foreground uppercase tracking-wide cursor-pointer hover:text-primary transition-colors"
                onClick={() => !readonly && onEdit(separator)}
              >
                {separator.nombre}
              </h3>
            )}
            <div
              className="h-px flex-1"
              style={{
                backgroundColor: separator.color || "rgb(var(--border))",
              }}
            ></div>
          </div>
          {!readonly && !isEditing && (
            <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-accent"
                onClick={() => onEdit(separator)}
                title="Editar separador"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(separator.id)}
                title="Eliminar separador"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

