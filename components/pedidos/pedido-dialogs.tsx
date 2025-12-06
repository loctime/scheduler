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
import { Pedido } from "@/lib/types"

const DEFAULT_FORMAT = "{nombre} ({cantidad})"

interface PedidoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  name: string
  onNameChange: (value: string) => void
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  onSubmit()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!name.trim()}>
            {submitLabel}
          </Button>
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

