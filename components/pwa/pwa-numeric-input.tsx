"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface PwaNumericInputProps extends Omit<React.ComponentProps<typeof Input>, "type" | "inputMode" | "min"> {
  /** Mínimo permitido. Por defecto 0. Usar allowNegative para inputs que permiten negativos. */
  min?: number
  /** Si true, no se aplica min (permite egresos en stock, etc.) */
  allowNegative?: boolean
  step?: number
}

/**
 * Input numérico optimizado para PWA: al hacer focus/touch, selecciona todo el valor
 * para que el usuario pueda escribir directamente sin borrar manualmente.
 * Solo para uso en componentes del módulo /pwa.
 */
export function PwaNumericInput({ onFocus, min, allowNegative, className, ...props }: PwaNumericInputProps) {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(e)
    // setTimeout necesario en mobile para que el teclado se muestre antes de select()
    setTimeout(() => e.target.select(), 0)
  }

  const minProp = allowNegative ? undefined : (min ?? 0)

  return (
    <Input
      type="number"
      inputMode="numeric"
      {...(minProp !== undefined && { min: minProp })}
      onFocus={handleFocus}
      className={cn(className)}
      {...props}
    />
  )
}
