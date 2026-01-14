import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Horario del día",
  description: "Visualización del horario semanal del personal",
  manifest: "/manifest-horario.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Horario del día",
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#3b82f6",
}

export default function HorarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
