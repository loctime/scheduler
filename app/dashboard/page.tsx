"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import ScheduleCalendar from "@/components/schedule-calendar"
import { useData } from "@/contexts/data-context"

export default function DashboardPage() {
  const { user } = useData()

  return (
    <DashboardLayout user={user}>
      <ScheduleCalendar user={user} />
    </DashboardLayout>
  )
}
