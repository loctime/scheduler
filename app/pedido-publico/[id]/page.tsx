"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { db, COLLECTIONS } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { useEnlacePublico } from "@/hooks/use-enlace-publico"
import { EnlacePublicoForm } from "@/components/pedidos/enlace-publico-form"
import { ConfirmarEnvioDialog, ConfirmarEdicionDialog } from "@/components/pedidos/pedido-dialogs"
import { Package, Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"
import type { Pedido, Producto, EnlacePublico, Configuracion } from "@/lib/types"
import { generarNumeroRemito, crearRemitoEnvioDesdeDisponibles } from "@/lib/remito-utils"

export default function PedidoPublicoPage() {
  const params = useParams()
  const enlaceId = params.id as string
  const { obtenerEnlacePublico, actualizarProductosDisponibles, desactivarEnlace, loading } = useEnlacePublico(null)
  
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [enlacePublico, setEnlacePublico] = useState<EnlacePublico | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmarEnvioOpen, setConfirmarEnvioOpen] = useState(false)
  const [confirmarEdicionOpen, setConfirmarEdicionOpen] = useState(false)
  const [productosDisponiblesPendientes, setProductosDisponiblesPendientes] = useState<EnlacePublico["productosDisponibles"] | null>(null)
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false)
  const [nombreEmpresa, setNombreEmpresa] = useState<string>("")

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Validar que db esté disponible
        if (!db) {
          setError("Firebase no está configurado correctamente")
          setLoadingData(false)
          return
        }

        // Obtener enlace público
        const enlace = await obtenerEnlacePublico(enlaceId)
        if (!enlace || !enlace.activo) {
          setError("El enlace no es válido o ha sido desactivado")
          setLoadingData(false)
          return
        }

        setEnlacePublico(enlace)

        // Obtener pedido
        const pedidoDoc = await getDoc(doc(db, COLLECTIONS.PEDIDOS, enlace.pedidoId))
        if (!pedidoDoc.exists()) {
          setError("El pedido no existe")
          setLoadingData(false)
          return
        }

        const pedidoData = { id: pedidoDoc.id, ...pedidoDoc.data() } as Pedido
        setPedido(pedidoData)

        // Obtener configuración para nombre de empresa
        if (pedidoData.ownerId) {
          try {
            const configDoc = await getDoc(doc(db, COLLECTIONS.CONFIG, pedidoData.ownerId))
            if (configDoc.exists()) {
              const config = configDoc.data() as Configuracion
              setNombreEmpresa(config.nombreEmpresa || "Empresa")
            } else {
              setNombreEmpresa("Empresa")
            }
          } catch (err) {
            logger.error("Error al cargar configuración:", err)
            setNombreEmpresa("Empresa")
          }
        }

        // Verificar si el pedido ya está enviado (pero permitir editar con confirmación)
        if (pedidoData.estado === "enviado") {
          setPedidoConfirmado(true)
          // No mostrar error, permitir editar pero con confirmación
        } else if (pedidoData.estado === "recibido") {
          // Solo bloquear si está "recibido" (en proceso de recepción)
          // Permitir "completado" porque puede ser un nuevo pedido
          setError("Este pedido está en proceso de recepción y no puede ser modificado")
          setLoadingData(false)
          return
        }

        // Usar snapshot de productos si existe, sino leer dinámicamente (para enlaces antiguos)
        if (enlace.productosSnapshot && enlace.productosSnapshot.length > 0) {
          // Convertir snapshot a formato Producto
          const productosFromSnapshot = enlace.productosSnapshot
            .filter(p => (p.cantidadPedida ?? 0) > 0) // Solo incluir productos con cantidadPedida > 0
            .map(p => {
              const cantidadPedida = p.cantidadPedida ?? 0
              console.log(`Cargando producto ${p.nombre} del snapshot: stockMinimo=${p.stockMinimo}, cantidadPedida=${cantidadPedida}`)
              return {
                id: p.id,
                pedidoId: enlace.pedidoId,
                nombre: p.nombre,
                stockMinimo: p.stockMinimo,
                cantidadPedida: cantidadPedida, // Usar cantidadPedida del snapshot (ya filtrado)
                unidad: p.unidad,
                orden: p.orden,
                userId: enlace.userId,
              }
            }) as Producto[]
          console.log("Productos cargados del snapshot:", productosFromSnapshot)
          setProductos(productosFromSnapshot)
        } else {
          // Fallback: leer productos dinámicamente (para enlaces antiguos sin snapshot)
          const productosQuery = query(
            collection(db, COLLECTIONS.PRODUCTS),
            where("pedidoId", "==", enlace.pedidoId)
          )
          const productosSnapshot = await getDocs(productosQuery)
          const productosData = productosSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Producto[]

          productosData.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
          setProductos(productosData)
        }
      } catch (err: any) {
        logger.error("Error al cargar datos:", err)
        setError("Error al cargar el pedido")
      } finally {
        setLoadingData(false)
      }
    }

    if (enlaceId) {
      cargarDatos()
    }
  }, [enlaceId, obtenerEnlacePublico])

  // Función para cancelar el pedido confirmado
  const cancelarPedidoConfirmado = async () => {
    if (!pedido || !db) return

    try {
      // Eliminar el remito de envío si existe
      if (pedido.remitoEnvioId) {
        await deleteDoc(doc(db, COLLECTIONS.REMITOS, pedido.remitoEnvioId))
      }

      // Volver el estado del pedido a "creado"
      await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedido.id), {
        estado: "creado",
        remitoEnvioId: null,
        fechaEnvio: null,
        updatedAt: serverTimestamp(),
      })

      setPedidoConfirmado(false)
      setPedido({ ...pedido, estado: "creado", remitoEnvioId: undefined, fechaEnvio: undefined })
    } catch (error: any) {
      logger.error("Error al cancelar pedido:", error)
      alert(`Error al cancelar el pedido: ${error?.message || "Error desconocido"}`)
    }
  }

  const handleConfirmar = async (
    productosDisponibles: EnlacePublico["productosDisponibles"]
  ) => {
    if (!enlacePublico || !pedido || !db) return

    // Si el pedido ya está confirmado, mostrar modal de confirmación de edición
    if (pedidoConfirmado) {
      setProductosDisponiblesPendientes(productosDisponibles)
      setConfirmarEdicionOpen(true)
      return
    }

    // Mostrar modal de confirmación con detalles
    setProductosDisponiblesPendientes(productosDisponibles)
    setConfirmarEnvioOpen(true)
  }

  const ejecutarConfirmacion = async () => {
    if (!enlacePublico || !pedido || !db || !productosDisponiblesPendientes) return

    try {
      // Si el pedido estaba confirmado, cancelarlo primero
      if (pedidoConfirmado) {
        await cancelarPedidoConfirmado()
      }

      console.log("Iniciando confirmación de envío...")
      
      // 1. Actualizar el enlace con productosDisponibles
      console.log("Paso 1: Actualizando productos disponibles...")
      const success = await actualizarProductosDisponibles(
        enlacePublico.id,
        productosDisponiblesPendientes
      )

      if (!success) {
        alert("Error al actualizar el enlace")
        return
      }
      console.log("✓ Productos disponibles actualizados")

      // 2. Generar el remito automáticamente
      console.log("Paso 2: Generando datos del remito...")
      console.log("Productos disponibles pendientes:", JSON.stringify(productosDisponiblesPendientes, null, 2))
      console.log("Productos del pedido:", productos.map(p => ({ id: p.id, nombre: p.nombre, stockMinimo: p.stockMinimo })))
      
      // Verificar qué productos están marcados como disponibles
      const productosDisponiblesArray = Object.entries(productosDisponiblesPendientes || {})
      console.log("Productos marcados como disponibles:", productosDisponiblesArray.length)
      productosDisponiblesArray.forEach(([productoId, data]: [string, any]) => {
        console.log(`  - Producto ${productoId}: disponible=${data.disponible}, cantidadEnviada=${data.cantidadEnviada}`)
      })
      
      // Convertir array a Record
      const productosDisponiblesRecord = (productosDisponiblesPendientes || []).reduce((acc, item) => {
        acc[item.productoId] = {
          disponible: item.disponible,
          cantidadEnviada: item.cantidadEnviar,
        }
        return acc
      }, {} as Record<string, { disponible: boolean; cantidadEnviada?: number }>)

      const remitoData = crearRemitoEnvioDesdeDisponibles(
        pedido,
        productos,
        productosDisponiblesRecord
      )
      console.log("Datos del remito:", JSON.stringify(remitoData, null, 2))
      console.log("Productos en remitoData:", remitoData.productos)
      console.log("Cantidad de productos:", remitoData.productos?.length || 0)
      
      // Si no hay productos, es un error
      if (!remitoData.productos || remitoData.productos.length === 0) {
        alert("Error: No hay productos para enviar. Debes marcar al menos un producto como disponible y especificar la cantidad a enviar.")
        return
      }

      // Generar número de remito con nombre del pedido
      console.log("Paso 3: Generando número de remito...")
      const numeroRemito = await generarNumeroRemito(db, COLLECTIONS, pedido.nombre)
      console.log("Número de remito:", numeroRemito)

      // Crear remito en Firestore
      console.log("Paso 4: Creando remito en Firestore...")
      const remitoParaGuardar = {
        ...remitoData,
        numero: numeroRemito,
        createdAt: serverTimestamp(),
      }
      console.log("Datos que se van a guardar en Firestore:", JSON.stringify(remitoParaGuardar, null, 2))
      console.log("Productos en datos a guardar:", remitoParaGuardar.productos)
      console.log("Cantidad de productos a guardar:", remitoParaGuardar.productos?.length || 0)
      
      const remitoRef = await addDoc(collection(db, COLLECTIONS.REMITOS), remitoParaGuardar)
      console.log("✓ Remito creado:", remitoRef.id)
      
      // Verificar que se guardó correctamente leyendo el documento
      console.log("Intentando leer remito guardado...")
      try {
        const remitoGuardado = await getDoc(remitoRef)
        console.log("Remito guardado en Firestore:", remitoGuardado.data())
        console.log("Productos en remito guardado:", remitoGuardado.data()?.productos)
      } catch (readError: any) {
        console.warn("⚠️ Error al leer remito (no crítico):", readError)
        // Continuar de todas formas
      }

      // 3. Actualizar el pedido: estado "enviado", fechaEnvio, y vincular remito
      console.log("Paso 5: Actualizando pedido...")
      console.log("=== INICIO ACTUALIZACIÓN PEDIDO ===")
      console.log("Estado actual del pedido (en memoria):", pedido.estado)
      console.log("Pedido ID:", pedido.id)
      console.log("Remito ID a vincular:", remitoRef.id)
      
      // Leer el pedido nuevamente para obtener el estado más reciente
      console.log("Leyendo pedido desde Firestore...")
      const pedidoDocActualizado = await getDoc(doc(db, COLLECTIONS.PEDIDOS, pedido.id))
      console.log("Pedido leído exitosamente")
      if (!pedidoDocActualizado.exists()) {
        throw new Error("El pedido no existe")
      }
      const pedidoActualizado = { id: pedidoDocActualizado.id, ...pedidoDocActualizado.data() } as Pedido
      console.log("Estado actual del pedido (desde Firestore):", pedidoActualizado.estado)
      
      // Verificar que el pedido esté en un estado válido para actualizar
      if (pedidoActualizado.estado === "enviado" || pedidoActualizado.estado === "recibido") {
        console.warn("⚠️ El pedido ya está en estado", pedidoActualizado.estado, "- no se puede actualizar desde enlace público")
        alert("Este pedido ya fue procesado. No se puede actualizar nuevamente.")
        return
      }
      
      const updateData = {
        estado: "enviado",
        remitoEnvioId: remitoRef.id,
        fechaEnvio: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      console.log("Datos a actualizar en pedido:", JSON.stringify(updateData, null, 2))
      console.log("Verificando reglas: estado actual debe ser 'creado' o 'completado' para permitir actualización")
      console.log("Estado actual del pedido para validación:", pedidoActualizado.estado)
      console.log("¿Estado es 'creado' o 'completado'?", pedidoActualizado.estado === "creado" || pedidoActualizado.estado === "completado" || !pedidoActualizado.estado)
      
      try {
        await updateDoc(doc(db, COLLECTIONS.PEDIDOS, pedido.id), updateData)
        console.log("✓ Pedido actualizado exitosamente")
      } catch (updateError: any) {
        console.error("❌ Error específico al actualizar pedido:", updateError)
        console.error("Código de error:", updateError?.code)
        console.error("Mensaje de error:", updateError?.message)
        throw updateError
      }

      // 4. Desactivar el enlace para que no pueda ser editado nuevamente
      console.log("Paso 6: Desactivando enlace...")
      try {
        await desactivarEnlace(enlacePublico.id)
        console.log("✓ Enlace desactivado")
      } catch (desactivarError: any) {
        logger.error("Error al desactivar enlace (no crítico):", desactivarError)
      }

      console.log("✓ Confirmación completada exitosamente")
      
      // Recargar la página para actualizar el estado
      window.location.reload()
    } catch (error: any) {
      console.error("=== ERROR CAPTURADO ===")
      console.error("Tipo de error:", error?.constructor?.name)
      console.error("Código de error:", error?.code)
      console.error("Mensaje de error:", error?.message)
      console.error("Stack trace:", error?.stack)
      console.error("Error completo:", error)
      logger.error("Error al confirmar envío:", error)
      alert(`Error al procesar la confirmación: ${error?.message || "Error desconocido"}. Por favor, intente nuevamente.`)
    }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3 sm:space-y-4">
          <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin mx-auto text-primary" />
          <p className="text-sm sm:text-base text-muted-foreground">Cargando pedido...</p>
        </div>
      </div>
    )
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3 sm:space-y-4 max-w-md">
          <Package className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl sm:text-2xl font-bold">Error</h1>
          <p className="text-sm sm:text-base text-muted-foreground break-words">{error || "El pedido no existe"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold break-words">{pedido.nombre}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {nombreEmpresa || "Empresa"} • {new Date().toLocaleDateString('es-ES', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-3 sm:p-4 md:p-6">
          <EnlacePublicoForm
            productos={productos}
            enlacePublico={enlacePublico ?? undefined}
            onConfirmar={handleConfirmar}
            loading={loading}
            pedidoConfirmado={pedidoConfirmado}
          />
        </div>
      </div>

      {/* Modal de confirmación de envío */}
      {productosDisponiblesPendientes && (
        <ConfirmarEnvioDialog
          open={confirmarEnvioOpen}
          onOpenChange={setConfirmarEnvioOpen}
          onConfirm={ejecutarConfirmacion}
          nombrePedido={pedido?.nombre}
          nombreEmpresa={nombreEmpresa}
          fecha={new Date().toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
          productos={(() => {
            // Convertir array a Record para acceso rápido
            const productosDisponiblesMap = (productosDisponiblesPendientes || []).reduce((acc, item) => {
              acc[item.productoId] = item
              return acc
            }, {} as Record<string, { productoId: string; disponible: boolean; cantidadEnviar?: number }>)

            const productosFiltrados = productos
              .map(p => {
                const productoData = productosDisponiblesMap[p.id]
                const cantidadEnviada = productoData?.cantidadEnviar ?? 0
                const cantidadPedida = (p as any).cantidadPedida ?? 0
                
                // Incluir si tiene cantidad enviada > 0 o está marcado como disponible
                if (cantidadEnviada > 0 || productoData?.disponible) {
                  return {
                    nombre: p.nombre,
                    cantidadPedida: cantidadPedida,
                    cantidadEnviada: cantidadEnviada,
                    unidad: p.unidad || "U",
                    observaciones: undefined
                  }
                }
                return null
              })
              .filter((p): p is NonNullable<typeof p> => p !== null && p.cantidadEnviada > 0)
            
            console.log("Productos para modal:", productosFiltrados)
            console.log("Productos disponibles pendientes:", productosDisponiblesPendientes)
            
            return productosFiltrados
          })()}
        />
      )}

      {/* Modal de confirmación de edición */}
      <ConfirmarEdicionDialog
        open={confirmarEdicionOpen}
        onOpenChange={setConfirmarEdicionOpen}
        onConfirm={async () => {
          setConfirmarEdicionOpen(false)
          // Mostrar modal de confirmación de envío después de cancelar
          setConfirmarEnvioOpen(true)
        }}
      />
    </div>
  )
}
