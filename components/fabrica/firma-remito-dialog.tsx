"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FirmaDigital } from "@/components/remitos/firma-digital"
import type { Producto, EnlacePublico } from "@/lib/types"
import { useData } from "@/contexts/data-context"
import { useConfig } from "@/hooks/use-config"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Pen } from "lucide-react"

interface FirmaRemitoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (firma: { nombre: string; firma?: string }) => void
  nombrePedido: string
  productos: Producto[]
  productosDisponibles: EnlacePublico["productosDisponibles"]
}

export function FirmaRemitoDialog({
  open,
  onOpenChange,
  onConfirm,
  nombrePedido,
  productos,
  productosDisponibles,
}: FirmaRemitoDialogProps) {
  const { user } = useData()
  const { config } = useConfig(user)
  const [firma, setFirma] = useState<{ nombre: string; firma?: string }>({ nombre: "" })
  const [editandoFirma, setEditandoFirma] = useState(false)
  const [firmaTemporal, setFirmaTemporal] = useState<{ nombre: string; firma?: string }>({ nombre: "" })
  const initializedRef = useRef(false)

  // Cargar firma guardada cuando se abre el diálogo (solo una vez)
  useEffect(() => {
    if (open && config && !initializedRef.current) {
      const firmaGuardada = {
        nombre: config.nombreFirma || "",
        firma: config.firmaDigital,
      }
      if (firmaGuardada.nombre || firmaGuardada.firma) {
        setFirma(firmaGuardada)
        setEditandoFirma(false)
      } else {
        setFirma({ nombre: "" })
        setEditandoFirma(true)
      }
      initializedRef.current = true
    } else if (!open) {
      // Resetear cuando se cierra el diálogo
      initializedRef.current = false
    }
  }, [open, config])

  const handleConfirm = async () => {
    const firmaAUsar = editandoFirma ? firmaTemporal : firma
    
    if (!firmaAUsar.nombre.trim()) {
      alert("Debes ingresar tu nombre para firmar el remito")
      return
    }

    // Guardar firma en configuración si se editó o no existe
    if ((editandoFirma || !tieneFirmaGuardada) && user?.uid && db) {
      try {
        const configRef = doc(db, COLLECTIONS.CONFIG, user.uid)
        const configSnap = await getDoc(configRef)
        const currentConfig = configSnap.exists() ? configSnap.data() : {}
        
        await setDoc(configRef, {
          ...currentConfig,
          nombreFirma: firmaAUsar.nombre,
          firmaDigital: firmaAUsar.firma || null,
        }, { merge: true })
      } catch (error) {
        console.error("Error al guardar firma:", error)
      }
    }

    onConfirm(firmaAUsar)
    setFirmaTemporal({ nombre: "" })
  }

  const handleEditarFirma = () => {
    setFirmaTemporal({ ...firma })
    setEditandoFirma(true)
  }

  const handleCancelarEdicion = () => {
    // Restaurar la firma guardada original
    if (config) {
      const firmaGuardada = {
        nombre: config.nombreFirma || "",
        firma: config.firmaDigital,
      }
      setFirma(firmaGuardada)
    }
    setFirmaTemporal({ nombre: "" })
    setEditandoFirma(false)
  }

  const tieneFirmaGuardada = config?.nombreFirma || config?.firmaDigital

  // Callback memorizado para evitar bucles infinitos
  const handleFirmaChange = useCallback((nuevaFirma: { nombre: string; firma?: string }) => {
    if (editandoFirma) {
      setFirmaTemporal(nuevaFirma)
    } else {
      setFirma(nuevaFirma)
    }
  }, [editandoFirma])

  // Calcular resumen de productos
  // Convertir array a Record para acceso rápido
  const productosDisponiblesMap = (productosDisponibles || []).reduce((acc, item) => {
    acc[item.productoId] = item
    return acc
  }, {} as Record<string, { productoId: string; disponible: boolean; cantidadEnviar?: number }>)

  const productosResumen = productos
    .filter((p) => {
      if (!productosDisponibles) return false
      const data = productosDisponiblesMap[p.id]
      return data?.disponible && (data.cantidadEnviar ?? 0) > 0
    })
    .map((p) => {
      const data = productosDisponiblesMap[p.id]
      return {
        nombre: p.nombre,
        cantidad: data?.cantidadEnviar ?? 0,
        unidad: p.unidad || "U",
      }
    })

  const handleClose = (shouldOpen: boolean) => {
    if (!shouldOpen) {
      // Resetear estado al cerrar - el useEffect se encargará de inicializar cuando se abra de nuevo
      initializedRef.current = false
    }
    onOpenChange(shouldOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Firmar remito de envío</DialogTitle>
          <DialogDescription>
            Confirma los productos a enviar y firma el remito para {nombrePedido}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Resumen de productos */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Productos a enviar:</h3>
            <div className="space-y-2">
              {productosResumen.map((p, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{p.nombre}</span>
                  <span className="font-medium">
                    {p.cantidad} {p.unidad}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total de productos:</span>
                <span>{productosResumen.length}</span>
              </div>
            </div>
          </div>

          {/* Firma digital */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Firma digital:</h3>
              {tieneFirmaGuardada && !editandoFirma && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEditarFirma}
                >
                  <Pen className="h-4 w-4 mr-2" />
                  Editar firma
                </Button>
              )}
            </div>
            
            {editandoFirma || !tieneFirmaGuardada ? (
              <FirmaDigital
                nombre={editandoFirma ? firmaTemporal.nombre : firma.nombre}
                firma={editandoFirma ? firmaTemporal.firma : firma.firma}
                onFirmaChange={handleFirmaChange}
              />
            ) : (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Nombre:</div>
                  <div className="text-base font-medium">{firma.nombre}</div>
                </div>
                {firma.firma && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Firma:</div>
                    <div className="border rounded p-2 bg-white dark:bg-gray-900">
                      <img 
                        src={firma.firma} 
                        alt="Firma digital" 
                        className="max-w-full h-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            if (editandoFirma && tieneFirmaGuardada) {
              handleCancelarEdicion()
            } else {
              setEditandoFirma(false)
              setFirmaTemporal({ nombre: "" })
              onOpenChange(false)
            }
          }}>
            {editandoFirma && tieneFirmaGuardada ? "Cancelar edición" : "Cancelar"}
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={
              editandoFirma 
                ? !firmaTemporal.nombre.trim() 
                : !firma.nombre.trim()
            }
          >
            {tieneFirmaGuardada && !editandoFirma ? "Firmar" : "Confirmar y generar remito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

