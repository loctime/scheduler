/**
 * Temas de color por sección de la PWA.
 * - Mensual: naranja rojizo
 * - Horario: lila violeta
 * - Stock: rojo negro
 */
export const PWA_THEMES = {
  mensual: {
    /** Borde para botones (ej. ActionCard) */
    border: "border-orange-600",
    /** Fondo suave para header y footer */
    soft: "bg-orange-100",
  },
  horario: {
    border: "border-violet-600",
    soft: "bg-violet-100",
  },
  stock: {
    border: "border-red-900",
    soft: "bg-red-100",
  },
} as const

export type PwaThemeKey = keyof typeof PWA_THEMES

/** Devuelve el tema suave según pathname (para footer/header) */
export function getPwaSoftThemeByPath(pathname: string): string {
  if (pathname.includes("/mensual")) return PWA_THEMES.mensual.soft
  if (pathname.includes("/horario")) return PWA_THEMES.horario.soft
  if (pathname.includes("/stock-console")) return PWA_THEMES.stock.soft
  return "bg-gray-100"
}
