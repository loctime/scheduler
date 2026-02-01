import { format } from "date-fns"
import { es } from "date-fns/locale"

export interface WeekRangeDisplayProps {
  startDate: string // DD/MM/AAAA
  endDate: string   // DD/MM/AAAA
  className?: string
}

export function WeekRangeDisplay({ startDate, endDate, className = "" }: WeekRangeDisplayProps) {
  try {
    // Parsear fechas en formato DD/MM/AAAA
    const [startDay, startMonth, startYear] = startDate.split('/').map(Number)
    const [endDay, endMonth, endYear] = endDate.split('/').map(Number)
    
    const start = new Date(startYear, startMonth - 1, startDay)
    const end = new Date(endYear, endMonth - 1, endDay)
    
    // Validar fechas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return <span className={className}>Fechas inválidas</span>
    }

    const monthNames = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]

    const startMonthName = monthNames[start.getMonth()]
    const endMonthName = monthNames[end.getMonth()]
    const year = start.getFullYear()

    let displayText: string

    if (start.getMonth() === end.getMonth()) {
      // Mismo mes: "26 de enero – 01 de febrero, 2026" (corrección: debe ser mismo mes)
      displayText = `${startDay} de ${startMonthName} – ${endDay} de ${startMonthName}, ${year}`
    } else {
      // Diferente mes: "26 de enero – 01 de febrero, 2026"
      displayText = `${startDay} de ${startMonthName} – ${endDay} de ${endMonthName}, ${year}`
    }

    return <span className={className}>{displayText}</span>
  } catch {
    return <span className={className}>Formato de fecha inválido</span>
  }
}
