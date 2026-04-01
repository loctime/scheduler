"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { useData } from "@/contexts/data-context"

export default function GerentePage() {
  const { user } = useData()
  return (
    <DashboardLayout user={user}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-xl border border-gray-200 p-6 text-center">
          <h2 className="text-lg font-semibold">Seccion en migracion</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta seccion depende de roles legacy y fue deshabilitada en el nuevo modelo.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
