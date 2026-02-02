"use client"

import { useCallback, useState } from "react"
import { toPng } from "html-to-image"

export function useScheduleGridImage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generateImage = useCallback(async (element: HTMLElement) => {
    setLoading(true)

    try {
      const dataUrl = await toPng(element, {
        cacheBust: true,
        pixelRatio: 2, // calidad alta
        backgroundColor: "#ffffff",
      })

      setImageUrl(dataUrl)
    } catch (err) {
      console.error("Error generando imagen del horario", err)
    } finally {
      setLoading(false)
    }
  }, [])

  return { imageUrl, generateImage, loading }
}
