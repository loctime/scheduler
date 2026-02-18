"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, Settings, RotateCcw } from "lucide-react"
import Tesseract from "tesseract.js"
import type { Producto } from "@/lib/types"
import { OCRConfig, getOCRConfig, saveOCRConfig, DEFAULT_OCR_CONFIG } from "@/lib/ocr-config"
import { parseFactura, matchProducts, normalizeText, type ParsedItem, type MatchedItem } from "@/lib/ocr-utils"
import { saveProductAliases, getProductAliases } from "@/lib/ocr-config"
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function OCRConfigPage() {
  const [config, setConfig] = useState<OCRConfig>(DEFAULT_OCR_CONFIG)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [ocrText, setOcrText] = useState<string>("")
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([])
  const [products, setProducts] = useState<Producto[]>([])
  const [pedidos, setPedidos] = useState<any[]>([])
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string>("")
  const [selectedUnknownItem, setSelectedUnknownItem] = useState<MatchedItem | null>(null)
  const [assigningMap, setAssigningMap] = useState<Record<string, string>>({})

  // Load pedidos on mount
  useEffect(() => {
    const loadPedidos = async () => {
      try {
        if (!db) return
        
        const pedidosSnapshot = await getDocs(collection(db, "pedidos"))
        const pedidosList = pedidosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        setPedidos(pedidosList)
        
        // Auto-select first pedido if available
        if (pedidosList.length > 0) {
          setPedidoSeleccionadoId(pedidosList[0].id)
        }
      } catch (err) {
        console.error("Error loading pedidos:", err)
        setError("Error al cargar pedidos")
      }
    }
    
    loadPedidos()
  }, [])

  // Load products when pedido is selected
  useEffect(() => {
    const loadProducts = async () => {
      try {
        if (!db || !pedidoSeleccionadoId) return
        
        const pedidoDoc = await getDoc(doc(db, "pedidos", pedidoSeleccionadoId))
        if (!pedidoDoc.exists()) return
        
        const pedidoData = pedidoDoc.data()
        const productosSnapshot = await getDocs(collection(db, "pedidos", pedidoSeleccionadoId, "productos"))
        
        const productosList = productosSnapshot.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre || '',
          stockMinimo: doc.data().stockMinimo || 0,
          aliases: doc.data().aliases || [],
          pedidoId: pedidoSeleccionadoId,
          ownerId: doc.data().ownerId || '',
          userId: doc.data().userId || ''
        } as Producto))
        
        setProducts(productosList)
      } catch (err) {
        console.error("Error loading products:", err)
        setError("Error al cargar productos")
      }
    }
    
    loadProducts()
  }, [pedidoSeleccionadoId])

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const loadedConfig = await getOCRConfig()
        setConfig(loadedConfig)
      } catch (err) {
        console.error("Error loading config:", err)
        setError("Error al cargar configuración")
      }
    }
    
    loadConfig()
  }, [])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen es demasiado grande. Máximo 5MB.")
      return
    }
    
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setError("Formato no válido. Usa JPG, PNG o WebP.")
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
      
      // Parse with current config
      const parsed = parseFactura(text, config)
      setParsedItems(parsed)
      
      // Match with products using current config
      const matched = await matchProducts(parsed, products, config)
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

  const handleSaveConfig = useCallback(async () => {
    setSaving(true)
    setError(null)
    
    try {
      await saveOCRConfig(config)
      // Re-process with new config if we have OCR text
      if (ocrText) {
        const parsed = parseFactura(ocrText, config)
        setParsedItems(parsed)
        const matched = await matchProducts(parsed, products, config)
        setMatchedItems(matched)
      }
    } catch (err) {
      console.error("Error saving config:", err)
      setError("Error al guardar configuración")
    } finally {
      setSaving(false)
    }
  }, [config, ocrText, products])

  const handleResetConfig = useCallback(() => {
    setConfig(DEFAULT_OCR_CONFIG)
    setError(null)
  }, [])

  const handleAssignProduct = useCallback((item: MatchedItem) => {
    if (!item.matchedProductId) return
    
    setSelectedUnknownItem(item)
    setAssigningMap(prev => ({
      ...prev,
      [item.nombreDetectado]: ''
    }))
  }, [])

  const handleSaveAlias = useCallback(async (item: MatchedItem) => {
    const productId = assigningMap[item.nombreDetectado]
    if (!productId) return
    
    try {
      // Get current aliases
      const currentAliases = await getProductAliases(productId)
      
      // Add detected name as new alias
      const normalizedDetected = normalizeText(item.nombreDetectado)
      const newAliases = [...(currentAliases || []), normalizedDetected]
      
      // Limit to 20 aliases per product
      const limitedAliases = newAliases.slice(-20)
      
      // Remove duplicates
      const uniqueAliases = [...new Set(limitedAliases)]
      
      await saveProductAliases(productId, uniqueAliases)
      
      // Update local products state
      setProducts(prev => prev.map(p => 
        p.id === productId 
          ? { ...p, aliases: uniqueAliases }
          : p
      ))
      
      // Reset selection for this item
      setAssigningMap(prev => {
        const newMap = { ...prev }
        delete newMap[item.nombreDetectado]
        return newMap
      })
      setSelectedUnknownItem(null)
      
      // Re-process OCR text with new aliases
      if (ocrText) {
        const parsed = parseFactura(ocrText, config)
        const updatedProducts = products.map(p => 
          p.id === productId 
            ? { ...p, aliases: uniqueAliases }
            : p
        )
        const matched = await matchProducts(parsed, updatedProducts, config)
        setMatchedItems(matched)
      }
      
    } catch (error) {
      console.error("Error saving aliases:", error)
      setError("Error al guardar alias")
    }
  }, [assigningMap, products, config, ocrText])

  const handleConfigChange = useCallback((field: keyof OCRConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }, [])

const okItems = matchedItems.filter(item => item.status === "ok")
const unknownItems = matchedItems.filter(item => item.status === "unknown")

return (
  <div className="container mx-auto p-6 space-y-6">
    {/* Pedido Selector */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuración OCR
        </CardTitle>
        <CardDescription>
          Selecciona un pedido para cargar sus productos y entrenar el sistema de reconocimiento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="pedido-select">Seleccionar Pedido</Label>
          <select
              id="pedido-select"
              value={pedidoSeleccionadoId}
              onChange={(e) => setPedidoSeleccionadoId(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              disabled={pedidos.length === 0}
            >
              <option value="">Seleccionar pedido...</option>
              {pedidos.map(pedido => (
                <option key={pedido.id} value={pedido.id}>
                  {pedido.id} - {new Date(pedido.createdAt?.seconds * 1000).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>
        <CardHeader>
          <CardTitle>🔹 Sección 1 – Subir imagen</CardTitle>
          <CardDescription>
            Sube facturas/remitos de prueba para procesar con OCR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image-upload">Seleccionar imagen</Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={loading}
              className="cursor-pointer"
            />
            <p className="text-sm text-muted-foreground">
              Formatos: JPG, PNG, WebP. Máximo 5MB.
            </p>
          </div>

          <Button 
            onClick={() => document.getElementById('image-upload')?.click()}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Procesando OCR...
              </>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Procesar OCR
              </>
            )}
          </Button>
        </div>
        </CardContent>
      </Card>

      {/* Section 2 - OCR Raw Text */}
      {ocrText && (
        <Card>
          <CardHeader>
            <CardTitle>🔹 Sección 2 – Texto OCR crudo</CardTitle>
            <CardDescription>Texto detectado por OCR sin procesamiento</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={ocrText}
              readOnly
              placeholder="Texto detectado por OCR aparecerá aquí..."
              className="min-h-[200px] font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}

      {/* Section 3 - Parsed Results */}
      {matchedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🔹 Sección 3 – Resultado Parseado</CardTitle>
            <CardDescription>
              Productos detectados y matching con configuración actual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Resumen</h4>
                  <div className="space-y-1 text-sm">
                    <div>Productos reconocidos: {okItems.length}</div>
                    <div>Por ingresar manualmente: {unknownItems.length}</div>
                  </div>
                </div>
              </div>

              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Línea original</th>
                      <th className="text-left p-2">Producto detectado</th>
                      <th className="text-center p-2">Cantidad detectada</th>
                      <th className="text-center p-2">Similarity</th>
                      <th className="text-center p-2">Token Score</th>
                      <th className="text-center p-2">Final Score</th>
                      <th className="text-center p-2">Alias</th>
                      <th className="text-center p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedItems.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2 font-mono text-xs">{item.rawText}</td>
                        <td className="p-2">{item.nombreDetectado}</td>
                        <td className="text-center p-2 font-mono">{item.cantidad}</td>
                        <td className="text-center p-2 font-mono">
                          {item.similarity?.toFixed(2) || '-'}
                        </td>
                        <td className="text-center p-2 font-mono">
                          {item.tokenScore?.toFixed(2) || '-'}
                        </td>
                        <td className="text-center p-2 font-mono">
                          {item.finalScore?.toFixed(2) || '-'}
                        </td>
                        <td className="text-center p-2">
                          {item.matchedAlias || '-'}
                        </td>
                        <td className="text-center p-2">
                          <span className={"text-xs px-2 py-1 rounded " + (
                            item.status === "ok" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-yellow-100 text-yellow-800"
                          ) + ">"}>
                            {item.status}
                          </span>
                        </td>
                        <td className="text-center p-2">
                          {item.status === "unknown" && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`product-select-${index}`} className="text-sm">Asignar a producto:</Label>
                          <select
                            id={`product-select-${index}`}
                            value={assigningMap[item.nombreDetectado] || ""}
                            onChange={(e) => setAssigningMap(prev => ({
                              ...prev,
                              [item.nombreDetectado]: e.target.value
                            }))}
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="">Seleccionar producto...</option>
                            {products.map(product => (
                              <option key={product.id} value={product.id}>
                                {product.nombre}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => handleSaveAlias(item)}
                            disabled={!assigningMap[item.nombreDetectado]}
                          >
                            Guardar Alias
                          </Button>
                        </div>
                      )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4 - Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>🔹 Sección 4 – Configuración Editable</CardTitle>
          <CardDescription>
            Ajusta los parámetros de procesamiento OCR y matching
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="similarity-threshold">Similarity Threshold</Label>
              <Input
                id="similarity-threshold"
                type="number"
                step="0.1"
                min="0.1"
                max="1.0"
                value={config.similarityThreshold}
                onChange={(e) => handleConfigChange('similarityThreshold', parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Umbral de similitud para matching (0.1 - 1.0)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-cantidad">Max Cantidad Permitida</Label>
              <Input
                id="max-cantidad"
                type="number"
                min="1"
                max="1000"
                value={config.maxCantidadPermitida}
                onChange={(e) => handleConfigChange('maxCantidadPermitida', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Cantidad máxima considerada válida (1 - 1000)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exclude-words">Palabras a Excluir</Label>
            <Textarea
              id="exclude-words"
              value={config.excludeWords.join(', ')}
              onChange={(e) => handleConfigChange('excludeWords', e.target.value.split(',').map(w => w.trim()))}
              placeholder="TOTAL, IVA, CUIT, FECHA, SUBTOTAL, $, IMPORTE, PRECIO"
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Palabras separadas por coma que se ignorarán en el parsing
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSaveConfig}
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                "Guardar Configuración"
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={handleResetConfig}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset a valores por defecto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OCRConfigPage
