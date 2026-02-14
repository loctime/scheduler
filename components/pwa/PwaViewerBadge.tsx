"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "horario.viewer"
const VIEWER_CHANGED_EVENT = "horario.viewer.changed"

export interface ViewerInfo {
  employeeId: string
  employeeName: string
}

function readViewerFromStorage(): ViewerInfo | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { employeeId?: string; employeeName?: string }
    if (parsed?.employeeId && parsed?.employeeName) return parsed as ViewerInfo
    return null
  } catch {
    return null
  }
}

interface PwaViewerBadgeProps {
  companySlug?: string
  className?: string
  /** En header claro (ej. home); si false, estilo para fondo oscuro (ej. stock) */
  variant?: "default" | "light-on-dark"
}

export function PwaViewerBadge({ companySlug, className, variant = "default" }: PwaViewerBadgeProps) {
  const [viewer, setViewer] = useState<ViewerInfo | null>(null)

  useEffect(() => {
    setViewer(readViewerFromStorage())
    const handleChanged = () => setViewer(readViewerFromStorage())
    window.addEventListener(VIEWER_CHANGED_EVENT, handleChanged)
    return () => window.removeEventListener(VIEWER_CHANGED_EVENT, handleChanged)
  }, [])

  if (!viewer) return null

  const initial = (viewer.employeeName || "?").trim().charAt(0).toUpperCase()
  const isLight = variant === "light-on-dark"

  const content = (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 rounded-full text-xs font-medium overflow-hidden",
        "h-9 w-9 min-w-[2.25rem]",
        isLight
          ? "bg-white/20 text-white border border-white/30"
          : "bg-muted text-muted-foreground border border-border",
        className
      )}
      title={`Empleado: ${viewer.employeeName}`}
    >
      {initial}
    </span>
  )

  if (companySlug) {
    return (
      <Link
        href={`/pwa/${companySlug}/horario`}
        className="shrink-0"
        aria-label={`Sos ${viewer.employeeName}. Ir al horario para cambiar.`}
      >
        {content}
      </Link>
    )
  }

  return content
}

/** Disparar desde PublicHorarioPage al guardar el viewer para que el badge se actualice. */
export function notifyViewerChanged(viewer: ViewerInfo) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VIEWER_CHANGED_EVENT, { detail: viewer }))
  }
}

/** Disparar cuando se limpia la selección (ej. "Cambiar persona") para que el badge desaparezca. */
export function notifyViewerCleared() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VIEWER_CHANGED_EVENT))
  }
}
