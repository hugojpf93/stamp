import { useEffect, useRef } from 'react'
import { drawStampOnCanvas } from '../lib/stamp-renderer'

interface StampPreviewProps {
  lawyerName: string
  bottomText: string
  stampNumber: number
  radius?: number
  size?: number
}

export function StampPreview({
  lawyerName,
  bottomText,
  stampNumber,
  radius,
  size = 200
}: StampPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const r = radius || size * 0.4

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    ctx.clearRect(0, 0, size, size)

    drawStampOnCanvas(
      ctx,
      size / 2,
      size / 2,
      r,
      lawyerName || 'NOM AVOCAT',
      bottomText || 'AVOCAT',
      stampNumber
    )
  }, [lawyerName, bottomText, stampNumber, r, size])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Aperçu du tampon n°${stampNumber}`}
      style={{ display: 'block' }}
    />
  )
}
