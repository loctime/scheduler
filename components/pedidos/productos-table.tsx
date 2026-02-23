"use client"

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Upload, Package, Minus, Plus, PlusCircle, X, Check, AlertTriangle, Pencil, GripVertical } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Producto } from "@/lib/types"
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

/** Unidades por pack: 1 si es unidad, cantidadPorPack si es pack. */
function getUnidadesPorPack(p: Producto): number {
  if (p.modoCompra !== "pack" || !p.cantidadPorPack || p.cantidadPorPack < 1) return 1
  return p.cantidadPorPack
}

function isPack(p: Producto): boolean {
  return p.modoCompra === "pack" && getUnidadesPorPack(p) > 1
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
}: {
  value: number | undefined
  onChange: (v: number) => void
  min?: number
  className?: string
  onFocus?: () => void
}) {
  const num = value !== undefined ? value : 0
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      value={num}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      onFocus={(e) => {
        onFocus?.()
        setTimeout(() => (e.target as HTMLInputElement).select(), 0)
      }}
      className={cn("h-7 w-14 text-center text-sm font-medium px-1", className)}
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
}: {
  product: Producto
  isEditing: boolean
  value: string
  onStartEdit: () => void
  onValueChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
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
          className="h-7 text-sm flex-1 min-w-0"
        />
        <Button variant="ghost" size="icon" onClick={onSave} className="h-6 w-6 shrink-0 text-green-600">
          <Check className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-6 w-6 shrink-0">
          <X className="h-3 w-3" />
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
        className="text-left text-sm font-medium truncate flex-1 min-w-0 hover:bg-muted/50 active:bg-muted rounded px-1 -mx-1 touch-manipulation cursor-pointer"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {product.nombre}
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
        className="h-7 w-7 sm:h-6 sm:w-6 shrink-0 text-muted-foreground hover:text-foreground active:bg-muted touch-manipulation cursor-pointer"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        title="Editar nombre"
      >
        <Pencil className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
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
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Unidad</span>
      <Switch
        checked={isPack}
        onCheckedChange={(checked) => onChange(checked ? "pack" : "unidad")}
      />
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Pack</span>
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
  const disabled = !isPack(product)
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

/** Mín: en unidades si producto es unidad; en packs si producto es pack. Se guarda siempre en unidades en Firestore. */
function CellStockMinimo({
  product,
  localValueUnits,
  onLocalChangeUnits,
  onUpdateUnits,
}: {
  product: Producto
  localValueUnits: number
  onLocalChangeUnits: (units: number) => void
  onUpdateUnits: (units: number) => void
}) {
  const unidadesPorPack = getUnidadesPorPack(product)
  const isPackProduct = isPack(product)

  const displayValue = isPackProduct
    ? Math.floor(localValueUnits / unidadesPorPack)
    : localValueUnits

  const handleChange = (n: number) => {
    const units = isPackProduct ? n * unidadesPorPack : n
    onLocalChangeUnits(units)
    onUpdateUnits(units)
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6 rounded-full shrink-0"
        onClick={() => handleChange(Math.max(0, displayValue - 1))}
        disabled={displayValue <= 0}
      >
        <Minus className="h-2.5 w-2.5" />
      </Button>
      <NumericInput
        value={displayValue}
        onChange={(n) => handleChange(Math.max(0, n))}
        className="h-6 w-10 text-xs"
      />
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6 rounded-full shrink-0"
        onClick={() => handleChange(displayValue + 1)}
      >
        <Plus className="h-2.5 w-2.5" />
      </Button>
    </div>
  )
}

function CellStockActual({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const v = value ?? 0
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className={btnIcon}
        onClick={() => onChange(Math.max(0, v - 1))}
        disabled={v <= 0}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <NumericInput value={v} onChange={onChange} className="h-7 w-14 text-sm" />
      <Button variant="outline" size="icon" className={btnIcon} onClick={() => onChange(v + 1)}>
        <Plus className="h-3.5 w-3.5" />
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
  onDeleteProduct: (productId: string) => void
  isCritical?: boolean
  dragHandleProps?: any
  isDragging?: boolean
}

const ProductoRow = React.memo(function ProductoRow({
  product,
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
  onDeleteProduct,
  isCritical = false,
  dragHandleProps,
  isDragging = false,
}: ProductoRowProps) {
  const isEditingNombre = editingField?.id === product.id && editingField?.field === "nombre"
  const unidadesPorPackInputRef = useRef<HTMLInputElement | null>(null)
  const [focusUnidadesPorPack, setFocusUnidadesPorPack] = useState(false)

  useEffect(() => {
    if (focusUnidadesPorPack && isPack(product) && unidadesPorPackInputRef.current) {
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

  return (
    <div
      key={product.id}
      className={cn(
        "rounded-lg border bg-card px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2 shadow-sm hover:shadow-md transition-all",
        isCritical && "border-red-600 border-2 bg-red-50 shadow-md",
        isDragging && "opacity-50"
      )}
    >
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="shrink-0 flex items-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground lg:flex hidden"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      
      {isCritical && (
        <div className="shrink-0 flex items-center">
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex items-center gap-2">
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
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <CellTipo product={product} onChange={handleTipoChange} />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">U/pack</span>
          <CellUnidadesPorPack
            product={product}
            value={unidadesPorPackValue}
            onChange={(v) => setUnidadesPorPackEdit(product.id, v)}
            onBlur={(num) => {
              if (num >= 2 && num !== (product.cantidadPorPack ?? 6)) {
                onUpdateProduct(product.id, "cantidadPorPack", String(num))
              }
            }}
            inputRef={unidadesPorPackInputRef}
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">Mín</span>
          <CellStockMinimo
            product={product}
            localValueUnits={stockMinimoLocal}
            onLocalChangeUnits={(v) => setStockMinimoLocal(product.id, v)}
            onUpdateUnits={(v) => onUpdateProduct(product.id, "stockMinimo", String(v))}
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">Stock</span>
          <CellStockActual value={stockActualValue} onChange={(v) => onLocalStockChange(product.id, v)} />
        </div>

        <CellDelete onDelete={() => onDeleteProduct(product.id)} />
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

  // Estado local temporal para stock (optimización de performance)
  const [localStock, setLocalStock] = useState<Record<string, number>>({})
  const debounceTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  
  // Referencia para evitar que el efecto sobrescriba cambios de orden optimistas
  const isReorderingRef = useRef(false)

  // Sensores para drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Función para ordenar productos por criticidad (solo mobile)
  const sortProductsByCriticality = useCallback((productsList: Producto[]) => {
    if (!productsList || productsList.length === 0) {
      return productsList || []
    }
    
    // Verificar si hay productos críticos
    const hasCritical = productsList.some(product => {
      const stock = stockActual[product.id] ?? 0
      return product.stockMinimo > stock
    })
    
    if (!hasCritical) {
      return productsList
    }
    
    // Crear una copia del array y ordenar por criticidad: mayor criticidad primero
    return [...productsList].sort((a, b) => {
      const stockA = stockActual[a.id] ?? 0
      const stockB = stockActual[b.id] ?? 0

      const criticidadA = a.stockMinimo - stockA
      const criticidadB = b.stockMinimo - stockB

      // Ordenar descendente: mayor criticidad primero
      if (criticidadB === criticidadA) {
        return 0
      }
      return criticidadB - criticidadA
    })
  }, [stockActual])

  // Función para ordenar productos por orden manual (desktop)
  const sortProductsByOrder = useCallback((productsList: Producto[]) => {
    if (!productsList || productsList.length === 0) {
      return productsList || []
    }
    
    // Crear una copia del array y ordenar por campo `orden`
    return [...productsList].sort((a, b) => {
      const ordenA = a.orden ?? 0
      const ordenB = b.orden ?? 0
      return ordenA - ordenB
    })
  }, [])

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

  // Actualizar el ordenamiento cuando cambian los productos, el stock o el tamaño de pantalla
  useEffect(() => {
    // No sobrescribir si estamos en medio de un reordenamiento optimista
    if (isReorderingRef.current) {
      return
    }
    
    if (isDesktop) {
      // En desktop: usar orden manual
      const sorted = sortProductsByOrder(products)
      setProductsToRender(sorted)
    } else {
      // En mobile: usar orden por criticidad
      const sorted = sortProductsByCriticality(products)
      setProductsToRender(sorted)
    }
  }, [products, stockActual, isDesktop, sortProductsByCriticality, sortProductsByOrder])

  // Manejar el final del drag & drop
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = productsToRender.findIndex((p) => p.id === active.id)
    const newIndex = productsToRender.findIndex((p) => p.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Marcar que estamos reordenando para evitar que el efecto sobrescriba
    isReorderingRef.current = true

    // Guardar el orden anterior para poder revertir si falla
    const previousOrder = productsToRender

    // Actualizar el orden localmente inmediatamente (optimistic update)
    const newOrder = arrayMove(productsToRender, oldIndex, newIndex)
    setProductsToRender(newOrder)

    // Persistir el nuevo orden en segundo plano sin bloquear la UI
    if (onProductsOrderUpdate) {
      const newOrderIds = newOrder.map((p: Producto) => p.id)
      // No usar await para no bloquear la UI
      onProductsOrderUpdate(newOrderIds)
        .then(() => {
          // Cuando se complete exitosamente, permitir que el efecto actualice si es necesario
          isReorderingRef.current = false
        })
        .catch((error) => {
          console.error("Error al actualizar orden:", error)
          // Si falla, revertir al orden anterior
          isReorderingRef.current = false
          setProductsToRender(previousOrder)
        })
    } else {
      // Si no hay función de actualización, solo permitir que el efecto actualice
      isReorderingRef.current = false
    }
  }, [productsToRender, onProductsOrderUpdate])

  // Verificar si hay productos críticos para el indicador
  const hasCriticalProducts = useMemo(() => {
    return products.some(product => {
      const stock = stockActual[product.id] ?? 0
      return product.stockMinimo > stock
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

  const handleCreateProduct = useCallback(async () => {
    if (!onCreateProduct || !newProductNombre.trim()) return
    const stockMinimo = parseInt(newProductStockMinimo, 10) || stockMinimoDefault
    const modoCompra = newProductTipoCompra
    const cantidadPorPack = modoCompra === "pack" ? parseInt(newProductUnidadesPorPack, 10) : undefined
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

  // Renderizar productos - siempre usar useMemo fuera de cualquier condición
  const renderedProducts = useMemo(
    () =>
      productsToRender.map((product) => {
        // Usar localStock si existe, sino stockActual (para UI inmediata)
        const stockActualValue = localStock[product.id] ?? stockActual[product.id] ?? 0
        const criticidad = product.stockMinimo - stockActualValue
        const isCritical = criticidad > 0

        const productRowProps = {
          product,
          stockActualValue,
          stockMinimoLocal: stockMinimoLocal[product.id] ?? product.stockMinimo,
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
          onDeleteProduct,
          isCritical,
        }

        return isDesktop ? (
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
      productsToRender,
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
      onDeleteProduct,
      isDesktop,
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
            {isDesktop ? (
              <span className="ml-2 text-xs text-muted-foreground">(Orden manual - arrastra para reordenar)</span>
            ) : hasCriticalProducts ? (
              <span className="ml-2 text-xs text-orange-600">(Ordenado por criticidad)</span>
            ) : null}
          </p>
        </div>
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

      <div className="space-y-1 p-2">
        {isDesktop ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={productsToRender.map((p) => p.id)}
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
    </div>
  )
}
