"use client"

import React, { forwardRef, useRef } from "react"
import { ScheduleGrid } from "./schedule-grid"
import { Empleado, Turno } from "@/lib/types"

interface ScheduleGridCaptureProps {
  weekDays: Date[]
  employees: Empleado[]
  shifts: Turno[]
  schedule: any
  allEmployees?: Empleado[]
}

/**
 * Componente de captura robusto para generar imágenes del ScheduleGrid.
 * Siempre está montado pero renderizado fuera de pantalla para evitar problemas
 * con CollapsibleContent o elementos no visibles.
 */
export const ScheduleGridCapture = forwardRef<HTMLDivElement, ScheduleGridCaptureProps>(
  ({ weekDays, employees, shifts, schedule, allEmployees }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          position: "fixed",
          left: "-10000px",
          top: "0",
          opacity: "0",
          pointerEvents: "none",
          width: "1400px", // Ancho controlado para consistencia
          zIndex: "-9999"
        }}
        className="schedule-grid-capture-container"
      >
        <div style={{ width: "1400px", backgroundColor: "#ffffff" }}>
          <ScheduleGrid
            weekDays={weekDays}
            employees={employees}
            shifts={shifts}
            schedule={schedule}
            allEmployees={allEmployees}
            readonly={true}
          />
        </div>
      </div>
    )
  }
)

ScheduleGridCapture.displayName = "ScheduleGridCapture"
