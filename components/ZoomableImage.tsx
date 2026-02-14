"use client"

import { useState, useEffect, useCallback } from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"

const BODY_LOCK_CLASS = "zoomable-image-body-lock"

export interface ZoomableImageProps {
  src: string
  alt: string
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  className?: string
  style?: React.CSSProperties
}

/**
 * Imagen con zoom/pan/pinch: doble tap, pinch, rueda, Ctrl+scroll.
 * Fondo negro cuando está ampliada y bloqueo de scroll del body.
 */
export function ZoomableImage({ src, alt, onError, className, style }: ZoomableImageProps) {
  const [isZoomed, setIsZoomed] = useState(false)

  const handleTransformed = useCallback((_ref: unknown, state: { scale?: number }) => {
    const scale = state?.scale ?? 1
    setIsZoomed(scale > 1.01)
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    if (isZoomed) {
      document.body.classList.add(BODY_LOCK_CLASS)
    } else {
      document.body.classList.remove(BODY_LOCK_CLASS)
    }
    return () => {
      document.body.classList.remove(BODY_LOCK_CLASS)
    }
  }, [isZoomed])

  return (
    <div
      className={isZoomed ? "zoomable-image-wrapper zoomable-image-wrapper--zoomed" : "zoomable-image-wrapper"}
      data-zoomed={isZoomed}
    >
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={8}
        limitToBounds={false}
        centerOnInit
        onTransformed={handleTransformed}
        doubleClick={{ mode: "toggle", step: 0.7 }}
        wheel={{ step: 0.15, activationKeys: ["Control"] }}
        pinchEnabled
        panning={{ velocityDisabled: true }}
      >
        <TransformComponent
          wrapperStyle={{
            width: "100%",
            height: "100%",
            cursor: isZoomed ? "grab" : "default",
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
            src={src}
            alt={alt}
            onError={onError}
            className={className}
            style={{
              width: "100%",
              maxWidth: "100%",
              height: "auto",
              display: "block",
              maxHeight: "80vh",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
              ...style,
            }}
            draggable={false}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
