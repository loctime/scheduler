/**
 * Pure utility functions for normalizing catalog data from Firestore.
 * No JSX, no side effects.
 */

/**
 * Normalizes the `despachadores` field of a raw Firestore group document.
 * Returns a clean array of `{ locationId, locationName }` objects,
 * filtering out any malformed entries.
 */
export function normalizeDespachadoresGrupo(
  x: Record<string, unknown>
): Array<{ locationId: string; locationName: string }> {
  const raw = x.despachadores
  if (!Array.isArray(raw)) return []
  const out: Array<{ locationId: string; locationName: string }> = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const locationId = String(o.locationId ?? "").trim()
    const locationName = typeof o.locationName === "string" ? o.locationName.trim() : ""
    if (locationId && locationName) out.push({ locationId, locationName })
  }
  return out
}

/**
 * Normalizes a raw `productosIds` field from Firestore.
 * Deduplicates and removes empty strings.
 */
export function normalizeProductosIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const item of raw) {
    const id = String(item ?? "").trim()
    if (id) seen.add(id)
  }
  return [...seen]
}

/**
 * Parses a user-entered string as a positive finite number.
 * Accepts both comma and dot as decimal separator.
 * Returns `null` if the value is invalid or non-positive.
 */
export function parseFactor(raw: string): number | null {
  const value = Number(raw.replace(",", ".").trim())
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

/**
 * Builds a human-readable equivalence string for a product's unit conversion.
 * Returns "—" if `unidadAlt` or `factor` are missing/invalid.
 *
 * @example
 * calcularEquivalencia("Harina", "kg", "bolsa", 25) // "1 bolsa = 25 kg de Harina"
 */
export function calcularEquivalencia(
  nombre: string,
  unidad: string,
  unidadAlt: string | undefined,
  factor: number | undefined
): string {
  if (!unidadAlt?.trim() || !factor || factor <= 0) return "—"
  return `1 ${unidadAlt} = ${factor} ${unidad} de ${nombre}`
}
