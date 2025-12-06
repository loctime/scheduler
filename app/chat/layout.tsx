import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Chat de Stock - Asistente IA",
  description: "Asistente de chat para gestión de stock con IA",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Stock Chat",
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

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

