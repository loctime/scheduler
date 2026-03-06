export type LogisticsV2Flags = {
  enabled: boolean
  remitos: boolean
  recepciones: boolean
  devoluciones: boolean
}

export type LegacyFlags = {
  publicLinkReadOnly: boolean
}

export type FeatureFlags = {
  logisticsV2: LogisticsV2Flags
  legacy: LegacyFlags
}

const toBool = (value: string | undefined, fallback = false): boolean => {
  if (!value) return fallback
  return value === "1" || value.toLowerCase() === "true"
}

export function getDefaultFeatureFlags(): FeatureFlags {
  return {
    logisticsV2: {
      enabled: toBool(process.env.NEXT_PUBLIC_LOGISTICS_V2_ENABLED, false),
      remitos: toBool(process.env.NEXT_PUBLIC_LOGISTICS_V2_REMITOS, false),
      recepciones: toBool(process.env.NEXT_PUBLIC_LOGISTICS_V2_RECEPCIONES, false),
      devoluciones: toBool(process.env.NEXT_PUBLIC_LOGISTICS_V2_DEVOLUCIONES, false)
    },
    legacy: {
      publicLinkReadOnly: toBool(process.env.NEXT_PUBLIC_LEGACY_PUBLIC_LINK_READ_ONLY, true)
    }
  }
}
