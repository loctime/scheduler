import { useCallback, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import type { Empleado, Turno, Horario, Separador, MedioTurno } from "@/lib/types"
import { useExportImage } from "./image/exportImage"
import { useExportWeekPDF } from "./pdf/exportWeekPDF"
import { useExportMonthPDF } from "./pdf/exportMonthPDF"
import { useExportExcel } from "./excel/exportExcel"

export function useExportSchedule() {
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  // Importar los hooks especializados
  const { exportImage } = useExportImage()
  const { exportPDF } = useExportWeekPDF()
  const { exportMonthPDF } = useExportMonthPDF()
  const { exportExcel } = useExportExcel()


  // Wrapper para exportImage que maneja el estado de exporting
  const handleExportImage = useCallback(async (
    elementId: string, 
    filename: string,
    config?: { 
      nombreEmpresa?: string; 
      colorEmpresa?: string; 
      ownerId?: string;
      download?: boolean;
      showToast?: boolean;
      onImageReady?: (blob: Blob, dataUrl: string) => Promise<void> | void;
    }
  ) => {
    setExporting(true)
    try {
      await exportImage(elementId, filename, config)
    } finally {
      setExporting(false)
    }
  }, [exportImage])

  // Wrapper para exportPDF que maneja el estado de exporting
  const handleExportWeekPDF = useCallback(
    async (
      elementId: string,
      filename: string,
      config?: { 
        nombreEmpresa?: string; 
        colorEmpresa?: string;
      }
    ) => {
      setExporting(true)
      try {
        await exportPDF(elementId, filename, config)
      } finally {
        setExporting(false)
      }
    }, [exportPDF])

  // Wrapper para exportMonthPDF que maneja el estado de exporting
  const handleExportMonthPDF = useCallback(
    async (
      monthWeeks: Date[][],
      getWeekSchedule: (weekStartStr: string) => Horario | null,
      employees: Empleado[],
      shifts: Turno[],
      filename: string,
      config?: { 
        nombreEmpresa?: string; 
        colorEmpresa?: string;
        monthRange?: { startDate: Date; endDate: Date };
        mediosTurnos?: MedioTurno[];
        employeeMonthlyStats?: Record<string, any>;
        minutosDescanso?: number;
        horasMinimasParaDescanso?: number;
      }
    ) => {
      setExporting(true)
      try {
        await exportMonthPDF(monthWeeks, getWeekSchedule, employees, shifts, filename, config)
      } finally {
        setExporting(false)
      }
    }, [exportMonthPDF])

  // Wrapper para exportExcel que maneja el estado de exporting
  const handleExportExcel = useCallback(async (
    weekDays: Date[],
    employees: Empleado[],
    shifts: Turno[],
    schedule: Horario | null,
    filename: string,
    config?: { 
      separadores?: Separador[]; 
      ordenEmpleados?: string[]; 
      colorEmpresa?: string;
      nombreEmpresa?: string 
    }
  ) => {
    setExporting(true)
    try {
      await exportExcel(weekDays, employees, shifts, schedule, filename, config)
    } finally {
      setExporting(false)
    }
  }, [exportExcel])

  return { 
    exporting, 
    exportImage: handleExportImage, 
    exportPDF: handleExportWeekPDF,
    exportMonthPDF: handleExportMonthPDF,
    exportExcel: handleExportExcel
  }
}
