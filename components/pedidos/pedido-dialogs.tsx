"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Upload, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Pedido } from "@/lib/types"

const DEFAULT_FORMAT = "{nombre} ({cantidad})"
const FORMAT_EXAMPLES = [
  { format: "{nombre} ({cantidad})", example: "Leche (8)" },
  { format: "{cantidad} - {nombre}", example: "8 - Leche" },
  { format: "({cantidad}) {nombre}", example: "(8) Leche" },
  { format: "• {nombre}: {cantidad} {unidad}", example: "• Leche: 8 litros" },
  { format: "{nombre} x{cantidad}", example: "Leche x8" },
]

interface PedidoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  name: string
  onNameChange: (value: string) => void
  stockMin: string
  onStockMinChange: (value: string) => void
  format: string
  onFormatChange: (value: string) => void
  onSubmit: () => void
  submitLabel: string
}

export function PedidoFormDialog({
  open,
  onOpenChange,
  title,
  description,
  name,
  onNameChange,
  stockMin,
  onStockMinChange,
  format,
  onFormatChange,
  onSubmit,
  submitLabel,
}: PedidoFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pedidoName">Nombre del pedido *</Label>
            <Input
              id="pedidoName"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ej: Proveedor Bebidas, Almacén, etc."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="stockMin">Stock mínimo por defecto</Label>
            <Input
              id="stockMin"
              type="number"
              min="0"
              value={stockMin}
              onChange={(e) => onStockMinChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se aplicará a los nuevos productos importados
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="formato">Formato de salida</Label>
            <Input
              id="formato"
              value={format}
              onChange={(e) => onFormatChange(e.target.value)}
              placeholder="{nombre} ({cantidad})"
            />
            <p className="text-xs text-muted-foreground">
              Usa: <code>{"{nombre}"}</code>, <code>{"{cantidad}"}</code>, <code>{"{unidad}"}</code>
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {FORMAT_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onFormatChange(ex.format)}
                  className={cn(
                    "text-xs px-2 py-1 rounded border transition-colors",
                    format === ex.format 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-muted hover:bg-accent border-border"
                  )}
                >
                  {ex.example}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  importText: string
  onImportTextChange: (value: string) => void
  onImport: () => void
  stockMinimoDefault?: number
}

export function ImportDialog({
  open,
  onOpenChange,
  importText,
  onImportTextChange,
  onImport,
  stockMinimoDefault,
}: ImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Productos</DialogTitle>
          <DialogDescription>
            Pega una lista de productos (uno por línea)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            value={importText}
            onChange={(e) => onImportTextChange(e.target.value)}
            placeholder="Leche&#10;Pan&#10;Huevos&#10;..."
            className="min-h-48 font-mono text-sm"
          />
          {stockMinimoDefault !== undefined && (
            <p className="text-xs text-muted-foreground">
              Stock mínimo por defecto: <strong>{stockMinimoDefault}</strong>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onImportTextChange("") }}>
            Cancelar
          </Button>
          <Button onClick={onImport} disabled={!importText.trim()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeletePedidoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedidoName?: string
  productsCount: number
  onDelete: () => void
}

export function DeletePedidoDialog({
  open,
  onOpenChange,
  pedidoName,
  productsCount,
  onDelete,
}: DeletePedidoDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-2 border-destructive">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Pedido
          </AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar <strong>"{pedidoName}"</strong> y todos sus productos ({productsCount})?
            <br />Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface ClearStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClear: () => void
}

export function ClearStockDialog({
  open,
  onOpenChange,
  onClear,
}: ClearStockDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Limpiar Stock Actual?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrarán todos los valores de stock actual ingresados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onClear}>Limpiar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DEFAULT_FORMAT }

