"use client"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X, Cog, Upload, FileText, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Pedido } from "@/lib/types"

const FORMAT_EXAMPLES = [
  { format: "{nombre} ({cantidad})", example: "Leche (8)" },
  { format: "{cantidad} - {nombre}", example: "8 - Leche" },
  { format: "({cantidad}) {nombre}", example: "(8) Leche" },
  { format: "• {nombre}: {cantidad} {unidad}", example: "• Leche: 8 litros" },
  { format: "{nombre} x{cantidad}", example: "Leche x8" },
  {
    format: "{nombre} ({cantidadPacks} packs - {cantidadUnidades} {unidad})",
    example: "Coca 500 (2 packs - 12 unidades)"
  }
]

export interface PedidoHeaderProps {
  selectedPedido: Pedido | null
  showConfig: boolean
  setShowConfig: (show: boolean) => void
  isEditingName: boolean
  editingName: string
  setEditingName: (v: string) => void
  onStartEditName: () => void
  onSaveName: () => void
  onCancelEditName: () => void
  onNameKeyDown: (e: React.KeyboardEvent) => void
  isEditingMensaje: boolean
  editingMensaje: string
  setEditingMensaje: (v: string) => void
  onStartEditMensaje: () => void
  onSaveMensaje: () => void
  onCancelEditMensaje: () => void
  onMensajeKeyDown: (e: React.KeyboardEvent) => void
  isEditingSheetUrl: boolean
  editingSheetUrl: string
  setEditingSheetUrl: (v: string) => void
  onStartEditSheetUrl: () => void
  onSaveSheetUrl: () => void
  onCancelEditSheetUrl: () => void
  onSheetUrlKeyDown: (e: React.KeyboardEvent) => void
  onFormatChange: (format: string) => void
  onDiasEnvioChange: (dias: number[]) => void
  onImportClick: () => void
  onFacturaImportClick: () => void
  onDeleteClick: () => void
  nameInputRef: React.RefObject<HTMLInputElement | null>
  mensajeInputRef: React.RefObject<HTMLInputElement | null>
  sheetUrlInputRef: React.RefObject<HTMLInputElement | null>
}

export function PedidoHeader({
  selectedPedido,
  showConfig,
  setShowConfig,
  isEditingName,
  editingName,
  setEditingName,
  onStartEditName,
  onSaveName,
  onCancelEditName,
  onNameKeyDown,
  isEditingMensaje,
  editingMensaje,
  setEditingMensaje,
  onStartEditMensaje,
  onSaveMensaje,
  onCancelEditMensaje,
  onMensajeKeyDown,
  isEditingSheetUrl,
  editingSheetUrl,
  setEditingSheetUrl,
  onStartEditSheetUrl,
  onSaveSheetUrl,
  onCancelEditSheetUrl,
  onSheetUrlKeyDown,
  onFormatChange,
  onDiasEnvioChange,
  onImportClick,
  onFacturaImportClick,
  onDeleteClick,
  nameInputRef,
  mensajeInputRef,
  sheetUrlInputRef
}: PedidoHeaderProps) {
  const dias = [
    { value: 1, label: "L" },
    { value: 2, label: "M" },
    { value: 3, label: "X" },
    { value: 4, label: "J" },
    { value: 5, label: "V" },
    { value: 6, label: "S" },
    { value: 0, label: "D" },
  ]

  const toggleDia = (dia: number, checked: boolean) => {
    const current = selectedPedido?.diasEnvio || []
    if (checked) {
      onDiasEnvioChange([...current, dia])
    } else {
      onDiasEnvioChange(current.filter((d) => d !== dia))
    }
  }

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName, nameInputRef])

  useEffect(() => {
    if (isEditingMensaje && mensajeInputRef.current) {
      mensajeInputRef.current.focus()
      mensajeInputRef.current.select()
    }
  }, [isEditingMensaje, mensajeInputRef])

  useEffect(() => {
    if (isEditingSheetUrl && sheetUrlInputRef.current) {
      sheetUrlInputRef.current.focus()
      sheetUrlInputRef.current.select()
    }
  }, [isEditingSheetUrl, sheetUrlInputRef])

  if (!selectedPedido) return null

  return (
    <div className="rounded-lg border border-border bg-card p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 overflow-x-hidden">
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {isEditingName ? (
          <div className="flex items-center gap-1 min-w-0 flex-1 sm:flex-initial w-full sm:w-auto">
            <Input
              ref={nameInputRef}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={onNameKeyDown}
              className="text-sm sm:text-base font-bold h-7 sm:h-8 flex-1 min-w-0"
              placeholder="Nombre del pedido"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onSaveName}
              className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-green-600"
            >
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onCancelEditName} className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 min-w-0 flex-1 sm:flex-initial">
            <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{selectedPedido.nombre}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onStartEditName}
              className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 text-muted-foreground"
            >
              <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>
        )}

        <div className="flex gap-1 shrink-0 ml-auto">
          <Button
            variant={showConfig ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowConfig(!showConfig)}
            title="Configuración"
          >
            <Cog className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onImportClick}>
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onFacturaImportClick}
            title="Importar desde factura (OCR)"
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDeleteClick}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedPedido?.estado === "processing" && selectedPedido.assignedTo && (
        <Alert className="mt-2 sm:mt-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <AlertTitle className="text-xs sm:text-sm">Pedido en proceso</AlertTitle>
          <AlertDescription className="text-xs sm:text-sm">
            Este pedido está siendo procesado por:{" "}
            <strong>{selectedPedido.assignedToNombre || "Usuario de fábrica"}</strong> - Fábrica
          </AlertDescription>
        </Alert>
      )}

      {showConfig && (
        <div className="space-y-2 pt-1.5 border-t border-border">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Encabezado
            </label>
            <div className="flex items-center gap-1 mt-0.5">
              {isEditingMensaje ? (
                <>
                  <Input
                    ref={mensajeInputRef}
                    value={editingMensaje}
                    onChange={(e) => setEditingMensaje(e.target.value)}
                    onKeyDown={onMensajeKeyDown}
                    className="text-sm h-7 flex-1"
                    placeholder="Ej: Pedido de insumos:"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSaveMensaje}
                    className="h-7 w-7 shrink-0 text-green-600"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onCancelEditMensaje} className="h-7 w-7 shrink-0">
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <div
                  onClick={onStartEditMensaje}
                  className="flex-1 text-xs px-2 py-1 rounded border border-border bg-muted/50 cursor-pointer hover:bg-muted truncate"
                >
                  {selectedPedido.mensajePrevio || `📦 ${selectedPedido.nombre}`}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Formato
            </label>
            <div className="flex gap-1 overflow-x-auto mt-0.5 scrollbar-none -mx-1 px-1">
              {FORMAT_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onFormatChange(ex.format)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded border transition-colors whitespace-nowrap shrink-0",
                    selectedPedido.formatoSalida === ex.format
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-accent border-border"
                  )}
                >
                  {ex.example}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Link de Google Sheet del pedido
            </label>
            <p className="text-[9px] text-muted-foreground mt-0.5 mb-1">
              Pegá acá el link del Sheet que usa la empresa para este pedido.
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {isEditingSheetUrl ? (
                <>
                  <Input
                    ref={sheetUrlInputRef}
                    value={editingSheetUrl}
                    onChange={(e) => setEditingSheetUrl(e.target.value)}
                    onKeyDown={onSheetUrlKeyDown}
                    className="text-sm h-7 flex-1"
                    placeholder="https://docs.google.com/spreadsheets/..."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSaveSheetUrl}
                    className="h-7 w-7 shrink-0 text-green-600"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onCancelEditSheetUrl} className="h-7 w-7 shrink-0">
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <div
                  onClick={onStartEditSheetUrl}
                  className="flex-1 text-xs px-2 py-1 rounded border border-border bg-muted/50 cursor-pointer hover:bg-muted truncate"
                >
                  {selectedPedido.sheetUrl || "Sin configurar"}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Día de envío
            </label>
            <div className="mt-1 flex flex-wrap gap-2.5">
              {dias.map((d) => (
                <label key={d.value} className="flex items-center gap-1.5 text-xs cursor-pointer group">
                  <Checkbox
                    checked={(selectedPedido?.diasEnvio || []).includes(d.value)}
                    onCheckedChange={(checked) => toggleDia(d.value, checked === true)}
                  />
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {d.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
