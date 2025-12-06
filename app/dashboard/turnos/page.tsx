"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TurnosPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard/empleados")
  }, [router])

  return null
}
