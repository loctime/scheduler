import { format } from "date-fns"
import { es } from "date-fns/locale"

export interface DateDisplayProps {
  date: Date | string
  format?: "short" | "long" | "time" | "datetime" | "custom"
  customFormat?: string
  className?: string
}

export function DateDisplay({ 
  date, 
  format: formatType = "short", 
  customFormat,
  className = "" 
}: DateDisplayProps) {
  const dateObj = typeof date === "string" ? new Date(date) : date
  
  // Validar que la fecha sea válida
  if (isNaN(dateObj.getTime())) {
    return <span className={className}>Fecha inválida</span>
  }

  let formatString: string

  switch (formatType) {
    case "short":
      formatString = "dd/MM/yyyy"
      break
    case "long":
      formatString = "dd 'de' MMMM 'de' yyyy"
      break
    case "time":
      formatString = "HH:mm"
      break
    case "datetime":
      formatString = "dd/MM/yyyy HH:mm"
      break
    case "custom":
      formatString = customFormat || "dd/MM/yyyy"
      break
    default:
      formatString = "dd/MM/yyyy"
  }

  const formattedDate = format(dateObj, formatString, { locale: es })

  return <span className={className}>{formattedDate}</span>
}

// Componente específico para rangos de fechas
export interface DateRangeDisplayProps {
  startDate: Date | string
  endDate: Date | string
  className?: string
}

export function DateRangeDisplay({ startDate, endDate, className = "" }: DateRangeDisplayProps) {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate
  const end = typeof endDate === "string" ? new Date(endDate) : endDate

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return <span className={className}>Fechas inválidas</span>
  }

  const startFormatted = format(start, "dd/MM/yyyy", { locale: es })
  const endFormatted = format(end, "dd/MM/yyyy", { locale: es })

  return <span className={className}>{startFormatted} - {endFormatted}</span>
}

// Componente para mostrar semana en formato humano
export interface WeekDisplayProps {
  weekId: string
  startDate: string
  endDate: string
  className?: string
}

export function WeekDisplay({ weekId, startDate, endDate, className = "" }: WeekDisplayProps) {
  const monthNames = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ]

  try {
    const startDay = parseInt(startDate.split('/')[0], 10)
    const endDay = parseInt(endDate.split('/')[0], 10)
    const startMonth = parseInt(startDate.split('/')[1], 10) - 1
    const endMonth = parseInt(endDate.split('/')[1], 10) - 1
    const year = parseInt(startDate.split('/')[2], 10)

    let displayText: string

    if (startMonth === endMonth) {
      // Mismo mes
      displayText = `${startDay} al ${endDay} de ${monthNames[startMonth]} de ${year}`
    } else {
      // Diferente mes (ej: 28/12 al 03/01)
      displayText = `${startDay} de ${monthNames[startMonth]} al ${endDay} de ${monthNames[endMonth]} de ${year}`
    }

    return (
      <div className={className}>
        <div className="font-semibold">{displayText}</div>
        <div className="text-sm text-muted-foreground">{weekId}</div>
      </div>
    )
  } catch {
    return <span className={className}>Formato de semana inválido</span>
  }
}
