"use client"

import { useEffect, useState, useRef } from "react"
import { X } from "lucide-react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { Button } from "@/components/ui/button"

const FULLSCREEN_BODY_LOCK_CLASS = "fullscreen-schedule-body-lock"

export interface FullscreenScheduleViewerProps {
  /** URL de la imagen del horario */
  imageSrc: string
  /** Texto alternativo para la imagen */
  imageAlt: string
  /** Callback cuando se cierra el viewer */
  onClose: () => void
  /** Callback opcional para manejar errores de carga */
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
}

/**
 * Viewer de pantalla completa para horarios.
 * 
 * Características:
 * - Ocupa 100vw x 100vh sin limitaciones de contenedor
 * - Zoom libre con pinch/scroll/rueda
 * - Bloquea scroll del body cuando está activo
 * - Z-index alto para estar por encima de todo
 * - Fondo negro para mejor contraste
 */
export function FullscreenScheduleViewer({
  imageSrc,
  imageAlt,
  onClose,
  onError,
}: FullscreenScheduleViewerProps) {
  const [currentScale, setCurrentScale] = useState(1)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Bloquear scroll del body cuando el viewer está activo
  useEffect(() => {
    if (typeof document === "undefined") return

    document.body.classList.add(FULLSCREEN_BODY_LOCK_CLASS)

    return () => {
      document.body.classList.remove(FULLSCREEN_BODY_LOCK_CLASS)
    }
  }, [])

  // Manejar tecla Escape para cerrar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Cerrar solo si no hay zoom activo (escala <= 1.1)
    // Esto permite que el usuario haga pan cuando hay zoom sin cerrar accidentalmente
    if (currentScale <= 1.1) {
      // Pequeño delay para permitir que el doble click funcione primero
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
      clickTimeoutRef.current = setTimeout(() => {
        onClose()
      }, 200)
    }
  }

  const handleTransformClick = (e: React.MouseEvent) => {
    // Permitir que el click en el TransformComponent también cierre cuando no hay zoom
    if (currentScale <= 1.1) {
      e.stopPropagation()
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
      clickTimeoutRef.current = setTimeout(() => {
        onClose()
      }, 200)
    }
  }

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black cursor-pointer fullscreen-overlay-background"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
      onClick={handleOverlayClick}
      onTouchEnd={(e) => {
        // Cerrar al hacer tap cuando no hay zoom activo
        if (currentScale <= 1.1) {
          onClose()
        }
      }}
    >
      {/* Botón de cerrar */}
      <div className="absolute top-4 right-4 z-[10000]">
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          className="bg-black/50 hover:bg-black/70 text-white border-white/20"
          aria-label="Cerrar pantalla completa"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Contenedor del zoom */}
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={10}
        limitToBounds={false}
        centerOnInit
        doubleClick={{ mode: "toggle", step: 0.7 }}
        wheel={{ step: 0.15 }}
        panning={{ velocityDisabled: true }}
        pinch={{ step: 5 }}
        onTransformed={(_ref, state) => {
          setCurrentScale(state.scale || 1)
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Controles de zoom (opcionales, pueden ocultarse si prefieres solo gestos) */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[10000] flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => zoomOut()}
                className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                aria-label="Alejar"
              >
                <span className="text-lg">−</span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => resetTransform()}
                className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                aria-label="Restablecer zoom"
              >
                <span className="text-sm">⌂</span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => zoomIn()}
                className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                aria-label="Acercar"
              >
                <span className="text-lg">+</span>
              </Button>
            </div>

            <div onClick={handleTransformClick} style={{ width: "100%", height: "100%" }}>
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  cursor: currentScale > 1.1 ? "grab" : "pointer",
                }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  onError={onError}
                  style={{
                    maxWidth: "100vw",
                    maxHeight: "100vh",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    pointerEvents: "none",
                    userSelect: "none",
                    display: "block",
                  }}
                  draggable={false}
                />
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
