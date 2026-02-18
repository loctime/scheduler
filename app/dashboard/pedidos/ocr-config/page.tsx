"use client"

import React, { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2, Upload, Settings, RotateCcw } from "lucide-react"
import Tesseract from "tesseract.js"
import type { Producto } from "@/lib/types"
import {
  OCRConfig,
  getOCRConfig,
  saveOCRConfig,
  DEFAULT_OCR_CONFIG,
} from "@/lib/ocr-config"
import {
  parseFactura,
  matchProducts,
  normalizeText,
  type ParsedItem,
  type MatchedItem,
} from "@/lib/ocr-utils"
import {
  saveProductAliases,
  getProductAliases,
} from "@/lib/ocr-config"
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function OCRConfigPage() {
  const [config, setConfig] = useState<OCRConfig>(DEFAULT_OCR_CONFIG)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [ocrText, setOcrText] = useState("")
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([])

  const [products, setProducts] = useState<Producto[]>([])
  const [pedidos, setPedidos] = useState<any[]>([])
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState("")

  const [assigningMap, setAssigningMap] =
    useState<Record<string, string>>({})

  /* =========================
     LOAD PEDIDOS
  ========================== */

  useEffect(() => {
    const loadPedidos = async () => {
      if (!db) return
      const snap = await getDocs(collection(db, "pedidos"))
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      setPedidos(list)
      if (list.length > 0) {
        setPedidoSeleccionadoId(list[0].id)
      }
    }
    loadPedidos()
  }, [])

  /* =========================
     LOAD PRODUCTS
  ========================== */

  useEffect(() => {
    const loadProducts = async () => {
      if (!db || !pedidoSeleccionadoId) return

      const snap = await getDocs(
        collection(db, "pedidos", pedidoSeleccionadoId, "productos")
      )

      const list = snap.docs.map((d) => ({
        id: d.id,
        nombre: d.data().nombre || "",
        aliases: d.data().aliases || [],
      })) as Producto[]

      setProducts(list)
    }

    loadProducts()
  }, [pedidoSeleccionadoId])

  /* =========================
     LOAD CONFIG
  ========================== */

  useEffect(() => {
    const load = async () => {
      const c = await getOCRConfig()
      setConfig(c)
    }
    load()
  }, [])

  /* =========================
     OCR
  ========================== */

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setLoading(true)
      setError(null)

      try {
        const result = await Tesseract.recognize(file, "spa")
        const text = result.data.text
        setOcrText(text)

        const parsed = parseFactura(text, config)
        const matched = await matchProducts(parsed, products, config)
        setMatchedItems(matched)
      } catch (err) {
        console.error(err)
        setError("Error al procesar OCR")
      } finally {
        setLoading(false)
      }
    },
    [config, products]
  )

  /* =========================
     SAVE CONFIG
  ========================== */

  const handleSaveConfig = async () => {
    setSaving(true)
    await saveOCRConfig(config)
    setSaving(false)
  }

  const handleConfigChange = (
    field: keyof OCRConfig,
    value: any
  ) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  const okItems = matchedItems.filter((i) => i.status === "ok")
  const unknownItems = matchedItems.filter(
    (i) => i.status === "unknown"
  )

  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* =========================
          PEDIDO SELECTOR
      ========================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración OCR
          </CardTitle>
          <CardDescription>
            Selecciona un pedido para entrenar el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={pedidoSeleccionadoId}
            onChange={(e) =>
              setPedidoSeleccionadoId(e.target.value)
            }
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Seleccionar pedido...</option>
            {pedidos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* =========================
          SUBIR IMAGEN
      ========================== */}
      <Card>
        <CardHeader>
          <CardTitle>Subir imagen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={loading}
          />

          <Button disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Procesando OCR...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Procesar OCR
              </>
            )}
          </Button>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
        </CardContent>
      </Card>

      {/* =========================
          RESULTADOS
      ========================== */}
      {matchedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado Parseado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-4">
              Reconocidos: {okItems.length} | Manual:{" "}
              {unknownItems.length}
            </div>

            <table className="w-full text-sm border">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Original</th>
                  <th className="p-2">Detectado</th>
                  <th className="p-2">Cant</th>
                  <th className="p-2">Score</th>
                  <th className="p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {matchedItems.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{item.rawText}</td>
                    <td className="p-2">
                      {item.nombreDetectado}
                    </td>
                    <td className="p-2 text-center">
                      {item.cantidad}
                    </td>
                    <td className="p-2 text-center">
                      {item.finalScore?.toFixed(2)}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={
                          "px-2 py-1 rounded text-xs " +
                          (item.status === "ok"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800")
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* =========================
          CONFIG
      ========================== */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="number"
            step="0.1"
            value={config.similarityThreshold}
            onChange={(e) =>
              handleConfigChange(
                "similarityThreshold",
                parseFloat(e.target.value)
              )
            }
          />

          <Button
            onClick={handleSaveConfig}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar Configuración"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
