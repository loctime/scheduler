"use client"

import React, { useMemo, useContext } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useConfig } from "@/hooks/use-config"
import { DataContext } from "@/contexts/data-context"
import { hexToRgba } from "../utils/schedule-grid-utils"

interface GridHeaderProps {
  weekDays: Date[]
  user?: any // Usuario opcional (para páginas públicas sin DataProvider)
  onCloseSelector?: () => void
}

export function GridHeader({ weekDays, user: userProp, onCloseSelector }: GridHeaderProps) {
  // Usar useContext directamente para evitar el error si no hay DataProvider
  const dataContext = useContext(DataContext)
  const contextUser = dataContext?.user || null
  const user = userProp || contextUser
  const { config } = useConfig(user)
  const nombreEmpresa = config?.nombreEmpresa || "Empleado"
  const colorEmpresa = config?.colorEmpresa

  // Calcular el tamaño de fuente y si necesitamos truncar
  // Ancho disponible: 220px (min-w) - 48px (px-6 = 24px cada lado) = ~172px
  // Considerando fuente bold y diferentes tamaños:
  // - text-3xl (~30px): ~5-6 caracteres/línea → 15-18 chars en 3 líneas
  // - text-2xl (~24px): ~6-7 caracteres/línea → 18-21 chars en 3 líneas  
  // - text-xl (~20px): ~8-9 caracteres/línea → 24-27 chars en 3 líneas
  // - text-lg (~18px): ~9-10 caracteres/línea → 27-30 chars en 3 líneas
  // - text-base (~16px): ~10-11 caracteres/línea → 30-33 chars en 3 líneas
  
  const { fontSize, displayText } = useMemo(() => {
    const length = nombreEmpresa.length
    
    // Tamaños responsive: móvil primero, luego desktop
    // Límites aproximados de caracteres por tamaño de fuente (máximo 3 líneas)
    if (length <= 18) {
      return { fontSize: "text-sm sm:text-base md:text-lg lg:text-xl", displayText: nombreEmpresa }
    } else if (length <= 24) {
      return { fontSize: "text-xs sm:text-sm md:text-base lg:text-lg", displayText: nombreEmpresa }
    } else if (length <= 30) {
      return { fontSize: "text-xs sm:text-sm md:text-base lg:text-base", displayText: nombreEmpresa }
    } else if (length <= 36) {
      return { fontSize: "text-[10px] sm:text-xs md:text-sm lg:text-base", displayText: nombreEmpresa }
    } else if (length <= 42) {
      return { fontSize: "text-[10px] sm:text-xs md:text-sm", displayText: nombreEmpresa }
    } else {
      // Si es muy largo, truncar a 42 caracteres y usar text-sm
      return { fontSize: "text-[10px] sm:text-xs md:text-sm", displayText: nombreEmpresa.substring(0, 42) + "..." }
    }
  }, [nombreEmpresa])

  // Calcular el estilo de fondo si hay color configurado
  const rowStyle = useMemo(() => {
    if (colorEmpresa) {
      return {
        backgroundColor: hexToRgba(colorEmpresa, 0.3),
      }
    }
    return undefined
  }, [colorEmpresa])

  return (
    <thead>
      <tr className="border-b-2 border-black bg-muted/50" style={rowStyle}>
        <th 
          className="min-w-[140px] sm:min-w-[180px] md:min-w-[200px] lg:min-w-[220px] lg:max-w-[220px] border-r-2 border-black px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-left font-bold text-foreground"
          onClick={(e) => {
            if (onCloseSelector) {
              e.stopPropagation()
              onCloseSelector()
            }
          }}
        >
          <div className={`${fontSize} break-words leading-tight line-clamp-3`}>
            {displayText}
          </div>
        </th>
        {weekDays.map((day) => (
          <th
            key={day.toISOString()}
            className="min-w-[100px] sm:min-w-[140px] md:min-w-[160px] lg:min-w-[180px] border-r-2 border-black px-1.5 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-center font-bold text-foreground last:border-r-0"
            onClick={(e) => {
              if (onCloseSelector) {
                e.stopPropagation()
                onCloseSelector()
              }
            }}
          >
            <div className="flex flex-col">
              <span className="capitalize text-xs sm:text-sm md:text-base lg:text-lg font-bold">{format(day, "EEEE", { locale: es })}</span>
              <span className="text-[10px] sm:text-xs md:text-sm lg:text-base font-semibold text-muted-foreground">{format(day, "d MMM", { locale: es })}</span>
            </div>
          </th>
        ))}
      </tr>
    </thead>
  )
}

