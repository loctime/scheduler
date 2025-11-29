"use client"

import React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface GridHeaderProps {
  weekDays: Date[]
}

export function GridHeader({ weekDays }: GridHeaderProps) {
  return (
    <thead>
      <tr className="border-b-2 border-black bg-muted/50">
        <th className="min-w-[220px] border-r-2 border-black px-6 py-4 text-left text-xl font-semibold text-foreground">
          Empleado
        </th>
        {weekDays.map((day) => (
          <th
            key={day.toISOString()}
            className="min-w-[180px] border-r-2 border-black px-6 py-4 text-center text-xl font-semibold text-foreground last:border-r-0"
          >
            <div className="flex flex-col">
              <span className="capitalize">{format(day, "EEEE", { locale: es })}</span>
              <span className="text-base font-normal text-muted-foreground">{format(day, "d MMM", { locale: es })}</span>
            </div>
          </th>
        ))}
      </tr>
    </thead>
  )
}

