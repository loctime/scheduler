"use client"

import React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Separador } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Edit2, Trash2 } from "lucide-react"
import { hexToRgba } from "../utils/schedule-grid-utils"

interface SeparatorRowProps {
  separator: Separador
  weekDays: Date[]
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
  isFirstSeparator?: boolean
}

export function SeparatorRow({
  separator,
  weekDays,
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
  isFirstSeparator = false,
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
        <td colSpan={weekDays.length + 1} className="px-4 py-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="h-px flex-1"
                style={{
                  backgroundColor: separatorColor || "rgb(var(--border))",
                }}
              ></div>
              {isEditing ? (
                <div className="flex items-center gap-1.5">
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
          ></td>
          {weekDays.map((day) => (
            <td
              key={day.toISOString()}
              className="border-r-2 border-black px-2 py-0.5 text-center last:border-r-0"
              style={
                separatorColor
                  ? { backgroundColor: hexToRgba(separatorColor, 0.1) }
                  : { backgroundColor: "rgb(var(--muted) / 0.3)" }
              }
            >
              <span className="text-xs font-semibold text-muted-foreground capitalize">
                {format(day, "EEEE", { locale: es })}
              </span>
            </td>
          ))}
        </tr>
      )}
    </>
  )
}

