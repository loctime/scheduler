"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface EmployeeOption {
  id: string
  name: string
}

interface PwaEmployeeSelectorModalProps {
  open: boolean
  onClose: () => void
  employees: EmployeeOption[]
  onSelect: (employeeId: string, employeeName: string) => void
}

export function PwaEmployeeSelectorModal({
  open,
  onClose,
  employees,
  onSelect,
}: PwaEmployeeSelectorModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">¿Quién sos?</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {employees.map((employee) => (
              <Button
                key={employee.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => onSelect(employee.id, employee.name)}
              >
                {employee.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
