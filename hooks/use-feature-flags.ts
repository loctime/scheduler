"use client"

import { useMemo } from "react"
import { getDefaultFeatureFlags, type FeatureFlags } from "@/lib/config/feature-flags"

export function useFeatureFlags(ownerId?: string | null, branchId?: string | null): FeatureFlags {
  return useMemo(() => {
    const defaults = getDefaultFeatureFlags()

    // Punto de extension: overrides por owner/location desde backend/config remota
    // Por ahora se usa configuracion por ENV para minimizar riesgo en produccion.
    void ownerId
    void branchId

    return defaults
  }, [ownerId, branchId])
}

