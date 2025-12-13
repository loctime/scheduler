"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Pen } from "lucide-react"

interface FirmaDigitalProps {
  nombre?: string
  firma?: string
  onFirmaChange: (firma: { nombre: string; firma?: string }) => void
}

export function FirmaDigital({ nombre: nombreInicial = "", firma: firmaInicial, onFirmaChange }: FirmaDigitalProps) {
  const [nombre, setNombre] = useState(nombreInicial)
  const [firmaCanvas, setFirmaCanvas] = useState<string | null>(firmaInicial || null)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isInitialMount = useRef(true)
  const lastOnFirmaChangeRef = useRef(onFirmaChange)
  const prevPropsRef = useRef({ nombreInicial, firmaInicial })

  // Mantener referencia actualizada de onFirmaChange
  useEffect(() => {
    lastOnFirmaChangeRef.current = onFirmaChange
  }, [onFirmaChange])

  useEffect(() => {
    // Solo actualizar si los valores iniciales realmente cambiaron desde fuera (comparar con props anteriores)
    if (nombreInicial !== prevPropsRef.current.nombreInicial) {
      setNombre(nombreInicial)
      prevPropsRef.current.nombreInicial = nombreInicial
    }
    if (firmaInicial !== prevPropsRef.current.firmaInicial) {
      setFirmaCanvas(firmaInicial || null)
      prevPropsRef.current.firmaInicial = firmaInicial
    }
  }, [nombreInicial, firmaInicial])

  useEffect(() => {
    // Inicializar canvas
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.strokeStyle = "#000"
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
      }
    }
  }, [])

  // Solo llamar a onFirmaChange cuando el usuario hace cambios, no en el montaje inicial
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (nombre || firmaCanvas) {
      lastOnFirmaChangeRef.current({ nombre, firma: firmaCanvas || undefined })
    }
  }, [nombre, firmaCanvas])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = canvasRef.current
      if (canvas) {
        setFirmaCanvas(canvas.toDataURL())
      }
    }
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setFirmaCanvas(null)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de quien firma"
        />
      </div>

      <Tabs defaultValue="texto" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="texto">Texto</TabsTrigger>
          <TabsTrigger value="dibujar">Dibujar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="texto" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            El nombre ingresado arriba se usará como firma
          </p>
        </TabsContent>

        <TabsContent value="dibujar" className="space-y-2">
          <div className="relative border rounded-md">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full h-[150px] cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{ backgroundColor: "#fafafa" }}
            />
            {firmaCanvas && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={clearCanvas}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Dibuja tu firma en el área de arriba
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
