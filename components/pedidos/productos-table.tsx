"use client"

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Upload, Package, Minus, Plus, PlusCircle, X, Check, AlertTriangle, Pencil, GripVertical } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { Producto } from "@/lib/types"
import { getPedidoSugeridoUnits } from "@/lib/pedido-engine"
import { getStockStatus } from "@/lib/stock-status"
import {
  esModoPack,
  formatStockForDisplay,
  getCantidadPorPack,
  normalizeStockActualInput,
  normalizeStockMinimoInput,
  recalculateStockForPackChange,
  shouldPromptForPackChange,
  type PackChangeMode,
} from "@/lib/unidades-utils"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const btnIcon = "h-7 w-7 rounded-full transition-transform active:scale-95 shrink-0"
const NAVIGATION_COLUMNS = ["stockMinimoUnits", "stockActual"] as const

type SortMode = "manual" | "severity"
type NavigationColumn = (typeof NAVIGATION_COLUMNS)[number]

/** Hook para detectar si estamos en desktop (lg+) */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.matchMedia("(min-width: 1024px)").matches)
    }
    
    checkIsDesktop()
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    mediaQuery.addEventListener("change", checkIsDesktop)
    
    return () => mediaQuery.removeEventListener("change", checkIsDesktop)
  }, [])

  return isDesktop
}

// --- .Props de la tabla (sin modos ni lógica de pedido) ---

interface ProductosTableProps {
  products: Producto[]
  stockActual: Record<string, number>
  onStockChange: (productId: string, value: number) => void
  onUpdateProduct: (productId: string, field: string, value: string) => Promise<boolean>
  onDeleteProduct: (productId: string) => void
  onCreateProduct?: (
    nombre: string,
    stockMinimo?: number,
    unidad?: string,
    modoCompra?: "unidad" | "pack",
    cantidadPorPack?: number
  ) => Promise<string | null>
  onImport: () => void
  onProductsOrderUpdate?: (newOrder: string[]) => Promise<boolean>
  stockMinimoDefault?: number
}

// --- Input numérico reutilizable ---

function NumericInput({
  value,
  onChange,
  min = 0,
  className,
  onFocus,
  inputRef,
  onKeyDown,
  dataRow,
  dataCol,
}: {
  value: number | undefined
  onChange: (v: number) => void
  min?: number
  className?: string
  onFocus?: () => void
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  dataRow?: number
  dataCol?: NavigationColumn
}) {
  const num = value !== undefined ? value : 0
  return (
    <Input
      ref={inputRef}
      type="number"
      inputMode="numeric"
      min={min}
      value={num}
      data-row={dataRow}
      data-col={dataCol}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        onFocus?.()
        setTimeout(() => (e.target as HTMLInputElement).select(), 0)
      }}
      className={cn("h-9 w-16 text-center text-lg font-medium text-black px-1", className)}
    />
  )
}

// --- Celdas ---

function CellNombre({
  product,
  isEditing,
  value,
  onStartEdit,
  onValueChange,
  onSave,
  onCancel,
  inputRef,
  equivalencia,
}: {
  product: Producto
  isEditing: boolean
  value: string
  onStartEdit: () => void
  onValueChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  equivalencia?: { fullLabel: string }
}) {
  const handleEdit = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onStartEdit()
  }, [onStartEdit])
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave()
            if (e.key === "Escape") onCancel()
          }}
          className="h-9 text-lg text-black flex-1 min-w-0"
        />
        <Button variant="ghost" size="icon" onClick={onSave} className="h-7 w-7 shrink-0 text-green-600">
          <Check className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0 relative">
      <button
        type="button"
        onClick={handleEdit}
        onTouchEnd={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onStartEdit()
        }}
        className="text-left text-lg font-medium text-black truncate flex-1 min-w-0 hover:bg-muted/50 active:bg-muted rounded px-1 -mx-1 touch-manipulation cursor-pointer"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {product.nombre}
        {esModoPack(product) && equivalencia && (
          <span className="text-[11px] text-muted-foreground ml-1">
            {equivalencia.fullLabel}
          </span>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleEdit}
        onTouchEnd={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onStartEdit()
        }}
        className="h-8 w-8 sm:h-7 sm:w-7 shrink-0 text-muted-foreground hover:text-foreground active:bg-muted touch-manipulation cursor-pointer"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        title="Editar nombre"
      >
        <Pencil className="h-4 w-4 sm:h-3 sm:w-3" />
      </Button>
    </div>
  )
}

function CellTipo({
  product,
  onChange,
}: {
  product: Producto
  onChange: (tipo: "unidad" | "pack") => void
}) {
  const isPack = (product.modoCompra ?? "unidad") === "pack"
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-black whitespace-nowrap">Unidad</span>
      <Switch
        checked={isPack}
        onCheckedChange={(checked) => onChange(checked ? "pack" : "unidad")}
      />
      <span className="text-xs text-black whitespace-nowrap">Pack</span>
    </div>
  )
}

function CellUnidadesPorPack({
  product,
  value,
  onChange,
  onBlur,
  inputRef,
}: {
  product: Producto
  value: string
  onChange: (v: string) => void
  onBlur: (num: number) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const disabled = !esModoPack(product)
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={disabled ? 1 : 2}
        value={disabled ? "1" : value}
        onChange={(e) => !disabled && onChange(e.target.value)}
        onBlur={(e) => {
          if (disabled) return
          const n = parseInt(e.target.value, 10)
          if (!isNaN(n) && n >= 2) onBlur(n)
        }}
        disabled={disabled}
        className={cn(
          "h-7 w-14 text-center text-sm",
          disabled && "opacity-60 cursor-not-allowed"
        )}
      />
    </div>
  )
}

/** Mín: se persiste en unidades; pack es solo una forma de entrada en UI. */
function CellStockMinimo({
  product,
  localValueUnits,
  onLocalChangeUnits,
  onUpdateUnits,
  rowIndex,
  onKeyDown,
}: {
  product: Producto
  localValueUnits: number
  onLocalChangeUnits: (units: number) => void
  onUpdateUnits: (units: number) => void
  rowIndex: number
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>
}) {
  const displayValue = esModoPack(product)
    ? Math.floor(localValueUnits / getCantidadPorPack(product))
    : localValueUnits

  const handleChange = (n: number) => {
    const units = normalizeStockMinimoInput(product, n)
    onLocalChangeUnits(units)
    onUpdateUnits(units)
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full shrink-0"
        onClick={() => handleChange(Math.max(0, displayValue - 1))}
        disabled={displayValue <= 0}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <NumericInput
        value={displayValue}
        onChange={(n) => handleChange(Math.max(0, n))}
        className="h-8 w-14 text-sm"
        dataRow={rowIndex}
        dataCol="stockMinimoUnits"
        onKeyDown={onKeyDown}
      />
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full shrink-0"
        onClick={() => handleChange(displayValue + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function CellStockActual({
  product,
  value,
  onChange,
  rowIndex,
  onKeyDown,
}: {
  product: Producto
  value: number
  onChange: (v: number) => void
  rowIndex: number
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>
}) {
  const units = value ?? 0
  const displayValue = esModoPack(product)
    ? Math.floor(units / getCantidadPorPack(product))
    : units
  const handleChange = (nextValue: number) => {
    onChange(normalizeStockActualInput(product, Math.max(0, nextValue)))
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-full shrink-0"
        onClick={() => handleChange(Math.max(0, displayValue - 1))}
        disabled={displayValue <= 0}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <NumericInput
        value={displayValue}
        onChange={handleChange}
        className="h-9 w-16 text-lg"
        dataRow={rowIndex}
        dataCol="stockActual"
        onKeyDown={onKeyDown}
      />
      <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => handleChange(displayValue + 1)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

function CellDelete({ onDelete }: { onDelete: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDelete}
      className="h-7 w-7 shrink-0 rounded-full opacity-60 hover:opacity-100"
    >
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  )
}

// --- Fila de producto ---

interface ProductoRowProps {
  product: Producto
  rowIndex: number
  stockActualValue: number
  stockMinimoLocal: number
  setStockMinimoLocal: (productId: string, v: number) => void
  unidadesPorPackEdit: string
  setUnidadesPorPackEdit: (productId: string, v: string) => void
  editingField: { id: string; field: string } | null
  inlineValue: string
  setEditingField: (f: { id: string; field: string } | null) => void
  setInlineValue: (v: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onUpdateProduct: (productId: string, field: string, value: string) => Promise<boolean>
  onLocalStockChange: (productId: string, value: number) => void
  onPackSizeChange: (product: Producto, nextPack: number, stockActualUnits: number) => void
  onDeleteProduct: (productId: string) => void
  isCritical?: boolean
  severity?: number
  sortMode: SortMode
  onCellKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, col: NavigationColumn, productId: string) => void
  dragHandleProps?: any
  isDragging?: boolean
}

const ProductoRow = React.memo(function ProductoRow({
  product,
  rowIndex,
  stockActualValue,
  stockMinimoLocal,
  setStockMinimoLocal,
  unidadesPorPackEdit,
  setUnidadesPorPackEdit,
  editingField,
  inlineValue,
  setEditingField,
  setInlineValue,
  inputRef,
  onUpdateProduct,
  onLocalStockChange,
  onPackSizeChange,
  onDeleteProduct,
  isCritical = false,
  severity = 0,
  sortMode,
  onCellKeyDown,
  dragHandleProps,
  isDragging = false,
}: ProductoRowProps) {
  const isEditingNombre = editingField?.id === product.id && editingField?.field === "nombre"
  const unidadesPorPackInputRef = useRef<HTMLInputElement | null>(null)
  const [focusUnidadesPorPack, setFocusUnidadesPorPack] = useState(false)

  useEffect(() => {
    if (focusUnidadesPorPack && esModoPack(product) && unidadesPorPackInputRef.current) {
      unidadesPorPackInputRef.current.focus()
      unidadesPorPackInputRef.current.select()
      setFocusUnidadesPorPack(false)
    }
  }, [focusUnidadesPorPack, product.modoCompra, product.cantidadPorPack])

  const handleSaveNombre = useCallback(async () => {
    const ok = await onUpdateProduct(product.id, "nombre", inlineValue.trim())
    if (ok) {
      setEditingField(null)
      setInlineValue("")
    }
  }, [product.id, inlineValue, onUpdateProduct, setEditingField, setInlineValue])

  const handleCancelEdit = useCallback(() => {
    setEditingField(null)
    setInlineValue("")
  }, [setEditingField, setInlineValue])

  const handleTipoChange = useCallback(
    (tipo: "unidad" | "pack") => {
      onUpdateProduct(product.id, "modoCompra", tipo)
      if (tipo === "pack" && (!product.cantidadPorPack || product.cantidadPorPack < 2)) {
        onUpdateProduct(product.id, "cantidadPorPack", "6")
      }
      if (tipo === "pack") {
        setFocusUnidadesPorPack(true)
      }
    },
    [product.id, product.cantidadPorPack, onUpdateProduct]
  )

  const unidadesPorPackValue = unidadesPorPackEdit || String(product.cantidadPorPack ?? 6)
  const equivalencia = formatStockForDisplay(product, stockActualValue)

  return (
    <div
      key={product.id}
      className={cn(
        "grid grid-cols-[40px_32px_120px_140px_1fr_80px_80px] gap-2 items-center rounded-lg border bg-card px-3 py-4 shadow-sm hover:shadow-md transition-all duration-200 ease-out motion-safe:transition-transform",
        isCritical && "border-red-600 border-2 bg-red-50 shadow-md",
        sortMode === "severity" && isCritical && "ring-1 ring-red-200/80",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center justify-center pr-2 border-r border-border">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="flex items-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground lg:flex hidden"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-center pr-2 border-r border-border">
        {isCritical && (
          <AlertTriangle className="h-4 w-4 text-red-600" />
        )}
      </div>

      <div className="flex items-center justify-center gap-1 pr-2 border-r border-border">
        <CellStockMinimo
          product={product}
          localValueUnits={stockMinimoLocal}
          onLocalChangeUnits={(v) => setStockMinimoLocal(product.id, v)}
          onUpdateUnits={(v) => onUpdateProduct(product.id, "stockMinimoUnits", String(v))}
          rowIndex={rowIndex}
          onKeyDown={(e) => onCellKeyDown(e, rowIndex, "stockMinimoUnits", product.id)}
        />
      </div>

      <div className="flex items-center justify-center gap-1 pr-2 border-r border-border">
        <CellStockActual
          product={product}
          value={stockActualValue}
          onChange={(v) => onLocalStockChange(product.id, v)}
          rowIndex={rowIndex}
          onKeyDown={(e) => onCellKeyDown(e, rowIndex, "stockActual", product.id)}
        />
      </div>

      <div className="flex items-center gap-2 min-w-0 pr-2 border-r border-border">
        {sortMode === "severity" && severity > 0 && (
          <div className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            <span aria-hidden="true">🔺</span> {severity}
          </div>
        )}
        <CellNombre
          product={product}
          isEditing={isEditingNombre}
          value={inlineValue}
          onStartEdit={() => {
            setEditingField({ id: product.id, field: "nombre" })
            setInlineValue(product.nombre)
          }}
          onValueChange={setInlineValue}
          onSave={handleSaveNombre}
          onCancel={handleCancelEdit}
          inputRef={inputRef}
          equivalencia={equivalencia}
        />
      </div>

      <div className="flex items-center justify-center pr-2 border-r border-border">
        <CellTipo product={product} onChange={handleTipoChange} />
      </div>

      <div className="flex items-center justify-center">
        <CellUnidadesPorPack
          product={product}
          value={unidadesPorPackValue}
          onChange={(v) => setUnidadesPorPackEdit(product.id, v)}
          onBlur={(num) => {
            if (num >= 2 && num !== (product.cantidadPorPack ?? 6)) {
              onPackSizeChange(product, num, stockActualValue)
            }
          }}
          inputRef={unidadesPorPackInputRef}
        />
      </div>
    </div>
  )
})

// --- Componente Sortable para drag & drop ---

interface SortableProductoRowProps extends Omit<ProductoRowProps, "dragHandleProps" | "isDragging"> {
  id: string
}

function SortableProductoRow({
  id,
  ...props
}: SortableProductoRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ProductoRow
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  )
}

// --- Formulario de creación inline ---

function CreateProductForm({
  nombre,
  onNombreChange,
  stockMinimo,
  onStockMinimoChange,
  tipoCompra,
  onTipoCompraChange,
  unidadesPorPack,
  onUnidadesPorPackChange,
  onCreate,
  onCancel,
  stockMinimoDefault,
}: {
  nombre: string
  onNombreChange: (v: string) => void
  stockMinimo: string
  onStockMinimoChange: (v: string) => void
  tipoCompra: "unidad" | "pack"
  onTipoCompraChange: (v: "unidad" | "pack") => void
  unidadesPorPack: string
  onUnidadesPorPackChange: (v: string) => void
  onCreate: () => void
  onCancel: () => void
  stockMinimoDefault: number
}) {
  const isPack = tipoCompra === "pack"
  const qty = parseInt(unidadesPorPack, 10)
  const canCreate = nombre.trim() && (!isPack || (qty >= 2))
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3 space-y-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={nombre}
          onChange={(e) => onNombreChange(e.target.value)}
          placeholder="Nombre del producto"
          className="h-8 text-sm flex-1 min-w-[120px]"
        />
        <span className="text-xs text-muted-foreground">Mín</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={stockMinimo}
          onChange={(e) => onStockMinimoChange(e.target.value)}
          className="h-8 w-12 text-center text-sm"
        />
        <Select value={tipoCompra} onValueChange={(v: "unidad" | "pack") => onTipoCompraChange(v)}>
          <SelectTrigger className="h-8 w-[100px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unidad">Unidad</SelectItem>
            <SelectItem value="pack">Pack</SelectItem>
          </SelectContent>
        </Select>
        {isPack && (
          <>
            <span className="text-xs text-muted-foreground">U/pack</span>
            <Input
              type="number"
              inputMode="numeric"
              min={2}
              value={unidadesPorPack}
              onChange={(e) => onUnidadesPorPackChange(e.target.value)}
              className="h-8 w-14 text-center text-sm"
            />
          </>
        )}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreate}
            disabled={!canCreate}
            className="h-7 w-7 shrink-0 rounded-full"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7 shrink-0 rounded-full">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Tabla principal ---

export function ProductosTable({
  products,
  stockActual,
  onStockChange,
  onUpdateProduct,
  onDeleteProduct,
  onCreateProduct,
  onImport,
  onProductsOrderUpdate,
  stockMinimoDefault = 0,
}: ProductosTableProps) {
  // Validación: confirmar que el componente no se desmonta al cambiar de tab
  useEffect(() => {
    console.log("[ProductosTable] Componente montado")
    return () => {
      console.log("[ProductosTable] Componente desmontado - ⚠️ ESTO NO DEBE PASAR al cambiar de tab")
    }
  }, [])
  
  const isDesktop = useIsDesktop()
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null)
  const [inlineValue, setInlineValue] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [isCreatingProduct, setIsCreatingProduct] = useState(false)
  const [newProductNombre, setNewProductNombre] = useState("")
  const [newProductStockMinimo, setNewProductStockMinimo] = useState(String(stockMinimoDefault))
  const [newProductTipoCompra, setNewProductTipoCompra] = useState<"unidad" | "pack">("unidad")
  const [newProductUnidadesPorPack, setNewProductUnidadesPorPack] = useState("6")
  const newProductInputRef = useRef<HTMLInputElement | null>(null)

  const [stockMinimoLocal, setStockMinimoLocal] = useState<Record<string, number>>({})
  const [unidadesPorPackEdit, setUnidadesPorPackEditState] = useState<Record<string, string>>({})
  const [productsToRender, setProductsToRender] = useState<Producto[]>([])
  const [sortMode, setSortMode] = useState<SortMode>("manual")

  // Estado local temporal para stock (optimización de performance)
  const [localStock, setLocalStock] = useState<Record<string, number>>({})
  const debounceTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const [packChangeDialog, setPackChangeDialog] = useState<{
    product: Producto
    oldPack: number
    newPack: number
    stockActualUnits: number
    packsActuales: number
  } | null>(null)
  
  // Referencia para evitar que el efecto sobrescriba cambios de orden optimistas
  const isReorderingRef = useRef(false)

  // Sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Función para ordenar productos por orden manual
  const sortProductsByOrder = useCallback((productsList: Producto[]) => {
    if (!productsList || productsList.length === 0) {
      return productsList || []
    }
    return [...productsList].sort((a, b) => {
      const ordenA = a.orden ?? 0
      const ordenB = b.orden ?? 0
      return ordenA - ordenB
    })
  }, [])

  const manualProducts = useMemo(() => {
    return sortProductsByOrder(products)
  }, [products, sortProductsByOrder])

  // Inicializar localStock desde stockActual solo si no hay cambios pendientes
  useEffect(() => {
    // Solo actualizar localStock si no hay timeouts pendientes (sin cambios locales)
    const hasPendingChanges = Object.keys(debounceTimeoutRef.current).length > 0
    
    if (!hasPendingChanges) {
      setLocalStock(stockActual)
    } else {
      // Si hay cambios pendientes, solo sincronizar los productos que no tienen cambios locales
      setLocalStock((prev) => {
        const next = { ...prev }
        Object.keys(stockActual).forEach((productId) => {
          // Solo actualizar si no hay timeout pendiente para este producto
          if (!debounceTimeoutRef.current[productId]) {
            next[productId] = stockActual[productId]
          }
        })
        return next
      })
    }
  }, [stockActual])

  // Debounce para persistir cambios de stock (500ms)
  useEffect(() => {
    // Obtener todas las claves únicas de ambos objetos
    const allProductIds = new Set([
      ...Object.keys(localStock),
      ...Object.keys(stockActual),
    ])

    allProductIds.forEach((productId) => {
      const localValue = localStock[productId] ?? stockActual[productId] ?? 0
      const actualValue = stockActual[productId] ?? 0

      // Solo persistir si el valor cambió respecto a stockActual
      if (localValue !== actualValue) {
        // Limpiar timeout anterior si existe
        if (debounceTimeoutRef.current[productId]) {
          clearTimeout(debounceTimeoutRef.current[productId])
        }

        // Crear nuevo timeout
        debounceTimeoutRef.current[productId] = setTimeout(() => {
          onStockChange(productId, localValue)
          delete debounceTimeoutRef.current[productId]
        }, 500)
      } else {
        // Si los valores coinciden, limpiar timeout pendiente si existe
        if (debounceTimeoutRef.current[productId]) {
          clearTimeout(debounceTimeoutRef.current[productId])
          delete debounceTimeoutRef.current[productId]
        }
      }
    })

    // Cleanup: limpiar timeouts al desmontar o cuando cambie localStock
    return () => {
      Object.values(debounceTimeoutRef.current).forEach((timeout) => {
        clearTimeout(timeout)
      })
    }
  }, [localStock, stockActual, onStockChange])

  // Sincronizar el orden manual con el estado local optimista
  useEffect(() => {
    if (isReorderingRef.current) {
      return
    }
    setProductsToRender(manualProducts)
  }, [manualProducts])

  const persistManualOrder = useCallback((nextOrder: Producto[], previousOrder: Producto[]) => {
    isReorderingRef.current = true
    setProductsToRender(nextOrder)

    if (!onProductsOrderUpdate) {
      isReorderingRef.current = false
      return
    }

    onProductsOrderUpdate(nextOrder.map((p) => p.id))
      .then(() => {
        isReorderingRef.current = false
      })
      .catch((error) => {
        console.error("Error al actualizar orden:", error)
        isReorderingRef.current = false
        setProductsToRender(previousOrder)
      })
  }, [onProductsOrderUpdate])

  // Manejar el final del drag & drop
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (sortMode !== "manual") {
      return
    }

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = productsToRender.findIndex((p) => p.id === active.id)
    const newIndex = productsToRender.findIndex((p) => p.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const previousOrder = productsToRender
    const newOrder = arrayMove(productsToRender, oldIndex, newIndex)
    persistManualOrder(newOrder, previousOrder)
  }, [persistManualOrder, productsToRender, sortMode])

  const moveProductByKeyboard = useCallback((productId: string, direction: -1 | 1) => {
    const currentIndex = productsToRender.findIndex((product) => product.id === productId)
    const nextIndex = currentIndex + direction

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= productsToRender.length) {
      return
    }

    const previousOrder = productsToRender
    const nextOrder = arrayMove(productsToRender, currentIndex, nextIndex)
    persistManualOrder(nextOrder, previousOrder)
  }, [persistManualOrder, productsToRender])

  // Verificar si hay productos críticos para el indicador
  const hasCriticalProducts = useMemo(() => {
    return products.some(product => {
      const stock = stockActual[product.id] ?? 0
      return getStockStatus(product, stock) !== "OK"
    })
  }, [products, stockActual])

  useEffect(() => {
    if (isCreatingProduct && newProductInputRef.current) newProductInputRef.current.focus()
  }, [isCreatingProduct])

  useEffect(() => {
    const ids = new Set(products.map((p) => p.id))
    setStockMinimoLocal((prev) => {
      const next: Record<string, number> = {}
      Object.keys(prev).forEach((id) => {
        if (ids.has(id)) next[id] = prev[id]
      })
      return next
    })
    setUnidadesPorPackEditState((prev) => {
      const next: Record<string, string> = {}
      Object.keys(prev).forEach((id) => {
        if (ids.has(id)) next[id] = prev[id]
      })
      return next
    })
  }, [products])

  const setStockMinimoLocalFor = useCallback((productId: string, v: number) => {
    setStockMinimoLocal((prev) => ({ ...prev, [productId]: v }))
  }, [])

  const setUnidadesPorPackEdit = useCallback((productId: string, v: string) => {
    setUnidadesPorPackEditState((prev) => ({ ...prev, [productId]: v }))
  }, [])

  // Función para actualizar stock local (sin debounce inmediato)
  const handleLocalStockChange = useCallback((productId: string, value: number) => {
    setLocalStock((prev) => ({
      ...prev,
      [productId]: value,
    }))
  }, [])

  const handlePackSizeChange = useCallback(
    async (product: Producto, nextPack: number, stockActualUnits: number) => {
      const oldPack = getCantidadPorPack(product)
      if (!shouldPromptForPackChange(stockActualUnits, oldPack, nextPack)) {
        await onUpdateProduct(product.id, "cantidadPorPack", String(nextPack))
        setUnidadesPorPackEdit(product.id, String(nextPack))
        return
      }

      setPackChangeDialog({
        product,
        oldPack,
        newPack: nextPack,
        stockActualUnits,
        packsActuales: Math.floor(stockActualUnits / oldPack),
      })
    },
    [onUpdateProduct]
  )

  const confirmPackSizeChange = useCallback(
    async (mode: PackChangeMode) => {
      if (!packChangeDialog) return

      const { product, oldPack, newPack, stockActualUnits } = packChangeDialog
      const nextUnits = recalculateStockForPackChange(stockActualUnits, oldPack, newPack, mode)

      setLocalStock((prev) => ({
        ...prev,
        [product.id]: nextUnits,
      }))

      await onUpdateProduct(product.id, "cantidadPorPack", String(newPack))
      if (nextUnits !== stockActualUnits) {
        onStockChange(product.id, nextUnits)
      }

      setUnidadesPorPackEdit(product.id, String(newPack))
      setPackChangeDialog(null)
    },
    [onStockChange, onUpdateProduct, packChangeDialog, setUnidadesPorPackEdit]
  )

  const cancelPackSizeChange = useCallback(() => {
    if (!packChangeDialog) return
    setUnidadesPorPackEdit(packChangeDialog.product.id, String(packChangeDialog.oldPack))
    setPackChangeDialog(null)
  }, [packChangeDialog, setUnidadesPorPackEdit])

  const handleCreateProduct = useCallback(async () => {
    if (!onCreateProduct || !newProductNombre.trim()) return
    const modoCompra = newProductTipoCompra
    const cantidadPorPack = modoCompra === "pack" ? parseInt(newProductUnidadesPorPack, 10) : undefined
    const productoDraft: Producto = {
      id: "draft",
      pedidoId: "draft",
      nombre: newProductNombre.trim(),
      stockMinimoUnits: stockMinimoDefault,
      stockMinimo: stockMinimoDefault,
      unidad: "U",
      unidadBase: "U",
      modoCompra,
      cantidadPorPack,
      ownerId: "draft",
      userId: "draft",
    }
    const stockMinimo = normalizeStockMinimoInput(
      productoDraft,
      parseInt(newProductStockMinimo, 10) || stockMinimoDefault
    )
    const productId = await onCreateProduct(
      newProductNombre.trim(),
      stockMinimo,
      "U",
      modoCompra,
      cantidadPorPack && cantidadPorPack >= 2 ? cantidadPorPack : undefined
    )
    if (productId) {
      setNewProductNombre("")
      setNewProductStockMinimo(String(stockMinimoDefault))
      setNewProductTipoCompra("unidad")
      setNewProductUnidadesPorPack("6")
      setIsCreatingProduct(false)
    }
  }, [onCreateProduct, newProductNombre, newProductStockMinimo, newProductTipoCompra, newProductUnidadesPorPack, stockMinimoDefault])

  const displayedProducts = useMemo(() => {
    if (sortMode === "manual") {
      return productsToRender
    }

    const manualIndexes = new Map(productsToRender.map((product, index) => [product.id, index]))

    return [...productsToRender].sort((a, b) => {
      const severityA = getPedidoSugeridoUnits(a, localStock[a.id] ?? stockActual[a.id] ?? 0)
      const severityB = getPedidoSugeridoUnits(b, localStock[b.id] ?? stockActual[b.id] ?? 0)

      if (severityB !== severityA) {
        return severityB - severityA
      }

      return (manualIndexes.get(a.id) ?? 0) - (manualIndexes.get(b.id) ?? 0)
    })
  }, [localStock, productsToRender, sortMode, stockActual])

  const focusCell = useCallback((rowIndex: number, col: NavigationColumn) => {
    const target = document.querySelector<HTMLInputElement>(`[data-row="${rowIndex}"][data-col="${col}"]`)
    if (target) {
      target.focus()
      target.select()
    }
  }, [])

  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    col: NavigationColumn,
    productId: string
  ) => {
    if (e.shiftKey && e.key === "ArrowUp") {
      e.preventDefault()
      moveProductByKeyboard(productId, -1)
      return
    }

    if (e.shiftKey && e.key === "ArrowDown") {
      e.preventDefault()
      moveProductByKeyboard(productId, 1)
      return
    }

    const currentColIndex = NAVIGATION_COLUMNS.indexOf(col)
    let nextRow = rowIndex
    let nextColIndex = currentColIndex

    switch (e.key) {
      case "ArrowUp":
        nextRow = rowIndex - 1
        break
      case "ArrowDown":
        nextRow = rowIndex + 1
        break
      case "ArrowLeft":
        nextColIndex = currentColIndex - 1
        break
      case "ArrowRight":
        nextColIndex = currentColIndex + 1
        break
      default:
        return
    }

    // Validar límites de filas y columnas
    if (nextRow < 0 || nextRow >= displayedProducts.length) {
      return // No permitir navegar fuera de los límites de filas
    }
    
    const nextCol = NAVIGATION_COLUMNS[nextColIndex]
    if (!nextCol) {
      return // No permitir navegar fuera de los límites de columnas
    }

    e.preventDefault()
    focusCell(nextRow, nextCol)
  }, [displayedProducts.length, focusCell, moveProductByKeyboard])

  // Renderizar productos - siempre usar useMemo fuera de cualquier condición
  const renderedProducts = useMemo(
    () =>
      displayedProducts.map((product, rowIndex) => {
        // Usar localStock si existe, sino stockActual (para UI inmediata)
        const stockActualValue = localStock[product.id] ?? stockActual[product.id] ?? 0
        const severity = getPedidoSugeridoUnits(product, stockActualValue)
        const isCritical = getStockStatus(product, stockActualValue) !== "OK"

        const productRowProps = {
          product,
          rowIndex,
          stockActualValue,
          stockMinimoLocal: stockMinimoLocal[product.id] ?? product.stockMinimoUnits ?? product.stockMinimo ?? 0,
          setStockMinimoLocal: setStockMinimoLocalFor,
          unidadesPorPackEdit: unidadesPorPackEdit[product.id] ?? "",
          setUnidadesPorPackEdit,
          editingField,
          inlineValue,
          setEditingField,
          setInlineValue,
          inputRef,
          onUpdateProduct,
          onLocalStockChange: handleLocalStockChange,
          onPackSizeChange: handlePackSizeChange,
          onDeleteProduct,
          isCritical,
          severity,
          sortMode,
          onCellKeyDown: handleCellKeyDown,
        }

        return isDesktop && sortMode === "manual" ? (
          <SortableProductoRow
            key={product.id}
            id={product.id}
            {...productRowProps}
          />
        ) : (
          <ProductoRow
            key={product.id}
            {...productRowProps}
          />
        )
      }),
    [
      displayedProducts,
      localStock,
      stockActual,
      stockMinimoLocal,
      unidadesPorPackEdit,
      editingField,
      inlineValue,
      setStockMinimoLocalFor,
      setUnidadesPorPackEdit,
      setEditingField,
      setInlineValue,
      inputRef,
      onUpdateProduct,
      handleLocalStockChange,
      handlePackSizeChange,
      onDeleteProduct,
      isDesktop,
      sortMode,
      handleCellKeyDown,
    ]
  )

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-1.5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold">Productos</h3>
            <p className="text-[10px] text-muted-foreground">Importa productos</p>
          </div>
        </div>
        <div className="py-4 text-center">
          <Package className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
          <p className="text-muted-foreground text-[11px] mb-2">No hay productos</p>
          <Button onClick={onImport} size="sm" className="h-6 text-[11px] px-2">
            <Upload className="mr-1 h-3 w-3" />
            Importar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Productos</h3>
          <p className="text-xs text-muted-foreground">
            {products.length} productos
            {sortMode === "manual" ? (
              <span className="ml-2 text-xs text-muted-foreground">
                (Orden manual{isDesktop ? " - arrastra o usa Shift + flechas" : ""})
              </span>
            ) : hasCriticalProducts ? (
              <span className="ml-2 text-xs text-orange-600">(🔺 Prioridad de compra activa)</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={sortMode}
            onValueChange={(value) => {
              if (value === "manual" || value === "severity") {
                setSortMode(value)
              }
            }}
            variant="outline"
            size="sm"
            className="hidden sm:flex"
            aria-label="Modo de ordenamiento"
          >
            <ToggleGroupItem value="manual" className="text-xs px-2">
              Orden manual
            </ToggleGroupItem>
            <ToggleGroupItem value="severity" className="text-xs px-2">
              Prioridad de compra
            </ToggleGroupItem>
          </ToggleGroup>
          {onCreateProduct && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatingProduct(true)}
              className="h-7 text-xs px-2 rounded-full"
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" />
              Agregar
            </Button>
          )}
        </div>
      </div>

      {/* Encabezados de columna */}
      <div className="grid grid-cols-[40px_32px_120px_140px_1fr_80px_80px] gap-2 px-3 py-4 border-b border-border bg-muted/30 text-base font-semibold text-black">
        <div className="flex items-center justify-center pr-2 border-r border-border">
          {/* Espacio para drag handle */}
        </div>
        <div className="flex items-center justify-center pr-2 border-r border-border">
          {/* Espacio para warning */}
        </div>
        <div className="flex items-center justify-center pr-2 border-r border-border">Mín</div>
        <div className="flex items-center justify-center pr-2 border-r border-border">Stock</div>
        <div className="flex items-center pr-2 border-r border-border">Producto</div>
        <div className="flex items-center justify-center pr-2 border-r border-border">Tipo</div>
        <div className="flex items-center justify-center">U/pack</div>
      </div>

      <div className="p-2 space-y-1">
        {!isDesktop && (
          <div className="pb-1">
            <ToggleGroup
              type="single"
              value={sortMode}
              onValueChange={(value) => {
                if (value === "manual" || value === "severity") {
                  setSortMode(value)
                }
              }}
              variant="outline"
              size="sm"
              className="grid w-full grid-cols-2"
              aria-label="Modo de ordenamiento"
            >
              <ToggleGroupItem value="manual" className="text-xs">
                Orden manual
              </ToggleGroupItem>
              <ToggleGroupItem value="severity" className="text-xs">
                Prioridad de compra
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
        {isDesktop && sortMode === "manual" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayedProducts.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {renderedProducts}
            </SortableContext>
          </DndContext>
        ) : (
          renderedProducts
        )}

        {isCreatingProduct && onCreateProduct && (
          <CreateProductForm
            nombre={newProductNombre}
            onNombreChange={setNewProductNombre}
            stockMinimo={newProductStockMinimo}
            onStockMinimoChange={setNewProductStockMinimo}
            tipoCompra={newProductTipoCompra}
            onTipoCompraChange={setNewProductTipoCompra}
            unidadesPorPack={newProductUnidadesPorPack}
            onUnidadesPorPackChange={setNewProductUnidadesPorPack}
            onCreate={handleCreateProduct}
            onCancel={() => {
              setIsCreatingProduct(false)
              setNewProductNombre("")
              setNewProductStockMinimo(String(stockMinimoDefault))
              setNewProductTipoCompra("unidad")
              setNewProductUnidadesPorPack("6")
            }}
            stockMinimoDefault={stockMinimoDefault}
          />
        )}
      </div>

      <AlertDialog open={!!packChangeDialog} onOpenChange={(open) => {
        if (!open) {
          cancelPackSizeChange()
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar tamano del pack</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Este producto tiene stock registrado.</p>
                {packChangeDialog && (
                  <>
                    <p>
                      Stock actual:
                      {" "}
                      {packChangeDialog.stockActualUnits} unidades
                      {" "}
                      ({packChangeDialog.packsActuales} packs de {packChangeDialog.oldPack})
                    </p>
                    <p>El nuevo tamano de pack sera: {packChangeDialog.newPack} unidades por pack</p>
                    <p>Debes decidir como ajustar el inventario.</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => void confirmPackSizeChange("keep_units")}>
              Mantener unidades actuales
            </Button>
            <Button onClick={() => void confirmPackSizeChange("keep_packs")}>
              Mantener cantidad de packs
            </Button>
            <Button variant="destructive" onClick={() => void confirmPackSizeChange("clear_stock")}>
              Limpiar stock del producto
            </Button>
            <AlertDialogCancel onClick={cancelPackSizeChange}>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
