import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Panel de Fábrica - Stock",
  description: "Panel de gestión de pedidos para fábrica",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fábrica",
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3b82f6",
}

export default function FabricaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
