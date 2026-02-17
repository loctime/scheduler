"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, CheckCircle, AlertTriangle, X } from "lucide-react"
import Tesseract from "tesseract.js"
import type { Producto } from "@/lib/types"
import { getOCRConfig, DEFAULT_OCR_CONFIG } from "@/lib/ocr-config"
import { parseFactura, matchProducts, type ParsedItem, type MatchedItem } from "@/lib/ocr-utils"

interface FacturaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Producto[]
  stockActual: Record<string, number>
  onStockChange: (productId: string, newValue: number) => void
}

export function FacturaImportDialog({
  open,
  onOpenChange,
  products,
  stockActual,
  onStockChange
}: FacturaImportDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState<string>("")
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([])
  const [confirming, setConfirming] = useState(false)
  const [config, setConfig] = useState(DEFAULT_OCR_CONFIG)

  // Load OCR config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const ocrConfig = await getOCRConfig()
        setConfig(ocrConfig)
      } catch (error) {
        console.error("Error loading OCR config:", error)
      }
    }
    
    loadConfig()
  }, [])

  // Validate image file
  function validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    
    if (file.size > maxSize) {
      return { valid: false, error: "La imagen es demasiado grande. Máximo 5MB." }
    }
    
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: "Formato no válido. Usa JPG, PNG o WebP." }
    }
    
    return { valid: true }
  }

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Validate file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      setError(validation.error || "Error en el archivo")
      return
    }
    
    setLoading(true)
    setError(null)
    setOcrText("")
    setParsedItems([])
    setMatchedItems([])
    
    try {
      // Perform OCR
      const result = await Tesseract.recognize(file, "spa", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            // Optional: Show progress
          }
        }
      })
      
      const text = result.data.text
      setOcrText(text)
      
      // Parse the text
      const parsed = parseFactura(text, config)
      setParsedItems(parsed)
      
      // Match with products using current config
      const matched = matchProducts(parsed, products, config)
      setMatchedItems(matched)
      
      if (matched.length === 0) {
        setError("No se detectaron productos válidos en la imagen")
      }
      
    } catch (err) {
      console.error("OCR Error:", err)
      setError("Error al procesar la imagen. Intenta con una mejor calidad.")
    } finally {
      setLoading(false)
    }
  }, [config, products])

  const handleConfirm = useCallback(async () => {
    // Prevent double-click
    if (confirming) {
      return
    }
    
    setConfirming(true)
    setError(null)
    
    try {
      // Batch processing with current stock values
      const updates: Promise<void>[] = []
      
      for (const item of matchedItems) {
        if (item.status === "ok" && item.matchedProductId) {
          const currentStock = stockActual[item.matchedProductId] ?? 0
          const newStock = currentStock + item.cantidad
          updates.push(Promise.resolve(onStockChange(item.matchedProductId, newStock)))
        }
      }
      
      await Promise.all(updates)
      
      // Close dialog after successful updates
      onOpenChange(false)
      
      // Reset state
      setOcrText("")
      setParsedItems([])
      setMatchedItems([])
      
    } catch (err) {
      console.error("Stock update error:", err)
      setError("Error al actualizar el stock. Intenta nuevamente.")
    } finally {
      setConfirming(false)
    }
  }, [matchedItems, stockActual, onStockChange, onOpenChange])

  const handleClose = useCallback(() => {
    if (!loading && !confirming) {
      onOpenChange(false)
      // Reset state
      setError(null)
      setOcrText("")
      setParsedItems([])
      setMatchedItems([])
    }
  }, [loading, confirming, onOpenChange])

  const okItems = matchedItems.filter(item => item.status === "ok")
  const unknownItems = matchedItems.filter(item => item.status === "unknown")

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar desde Factura (OCR)</DialogTitle>
          <DialogDescription>
            Sube una imagen de factura o remito para detectar productos y actualizar stock automáticamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="image-upload">Seleccionar imagen</Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={loading || confirming}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground">
              Formatos: JPG, PNG, WebP. Máximo 5MB.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Procesando imagen con OCR...</span>
            </div>
          )}

          {/* Results Display */}
          {!loading && matchedItems.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Summary */}
                <div className="space-y-2">
                  <h4 className="font-medium">Resumen</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span>Productos reconocidos: {okItems.length}</span>
                    </div>
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                      <span>Por ingresar manualmente: {unknownItems.length}</span>
                    </div>
                  </div>
                </div>

                {/* OCR Text Preview */}
                <div className="space-y-2">
                  <h4 className="font-medium">Texto detectado (OCR)</h4>
                  <div className="text-xs bg-muted p-2 rounded max-h-24 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{ocrText}</pre>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="font-medium">Productos detectados</h4>
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Producto detectado</th>
                        <th className="text-center p-2">Cantidad</th>
                        <th className="text-center p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchedItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{item.nombreDetectado}</td>
                          <td className="text-center p-2 font-mono">{item.cantidad}</td>
                          <td className="text-center p-2">
                            {item.status === "ok" ? (
                              <div className="flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-green-600 text-xs">OK</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
                                <span className="text-yellow-600 text-xs">Unknown</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unknown Items Warning */}
              {unknownItems.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {unknownItems.length} producto(s) no se encontraron en el sistema. 
                    Deberán ingresarse manualmente después de la importación.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading || confirming}
          >
            Cancelar
          </Button>
          
          {okItems.length > 0 && (
            <Button
              onClick={handleConfirm}
              disabled={loading || confirming}
              className="min-w-[140px]"
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Actualizando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar ({okItems.length} productos)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
