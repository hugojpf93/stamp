import { useCallback, useRef, useState, useEffect } from 'react'
import { drawStampOnCanvas } from '../lib/stamp-renderer'
import { screenToPdf, pdfToScreen } from '../lib/coordinate-mapper'
import { StampPlacement } from '../types'

interface StampOverlayProps {
  pdfPageWidth: number
  pdfPageHeight: number
  displayWidth: number
  displayHeight: number
  currentPage: number
  nextNumber: number
  lawyerName: string
  bottomText: string
  stampRadius: number
  placements: StampPlacement[]
  onPlace: (pageIndex: number, x: number, y: number) => void
}

export function StampOverlay({
  pdfPageWidth,
  pdfPageHeight,
  displayWidth,
  displayHeight,
  currentPage,
  nextNumber,
  lawyerName,
  bottomText,
  stampRadius,
  placements,
  onPlace
}: StampOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null)

  // Adapter le rayon du tampon proportionnellement à la page (comme côté PDF)
  // Le rayon de référence (65) est calibré pour A4 portrait (largeur ~595pt)
  const A4_SHORT = 595.28
  const pageShortSide = Math.min(pdfPageWidth, pdfPageHeight)
  const scaledPdfRadius = stampRadius * (pageShortSide / A4_SHORT)

  // Taille du tampon à l'écran (proportionnelle)
  const displayStampRadius = (scaledPdfRadius / pdfPageWidth) * displayWidth

  // Dessiner le tampon de prévisualisation qui suit la souris
  useEffect(() => {
    const canvas = cursorCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = displayStampRadius * 2.5
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    ctx.clearRect(0, 0, size, size)
    ctx.globalAlpha = 0.6
    drawStampOnCanvas(
      ctx,
      size / 2,
      size / 2,
      displayStampRadius,
      lawyerName || 'NOM AVOCAT',
      bottomText || 'AVOCAT',
      nextNumber
    )
  }, [displayStampRadius, lawyerName, bottomText, nextNumber])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setMousePos(null)
  }, [])

  // Un tampon existe-t-il sur la première page de cette pièce ?
  const hasStampOnPiece = placements.length > 0
  const hasStampOnPage = placements.some((p) => p.pageIndex === currentPage - 1)

  // On ne peut tamponner QUE sur la page 1 (pageIndex === 0)
  const isFirstPage = currentPage === 1

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Bloquer le clic sur les pages > 1 ou si un tampon existe déjà (sauf déplacement page 1)
      if (!isFirstPage) return
      if (hasStampOnPiece && !hasStampOnPage) return

      const rect = e.currentTarget.getBoundingClientRect()
      const pdfCoords = screenToPdf(
        e.clientX,
        e.clientY,
        rect,
        pdfPageWidth,
        pdfPageHeight,
        displayWidth,
        displayHeight
      )
      onPlace(currentPage - 1, pdfCoords.x, pdfCoords.y)
    },
    [
      pdfPageWidth,
      pdfPageHeight,
      displayWidth,
      displayHeight,
      currentPage,
      onPlace,
      isFirstPage,
      hasStampOnPiece,
      hasStampOnPage
    ]
  )

  // Filtrer les placements de la page courante
  const currentPlacements = placements.filter((p) => p.pageIndex === currentPage - 1)

  return (
    <div
      ref={overlayRef}
      role="application"
      aria-label="Zone de placement du tampon"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: displayWidth,
        height: displayHeight,
        cursor: !isFirstPage
          ? 'default'
          : hasStampOnPage
            ? 'move'
            : hasStampOnPiece
              ? 'default'
              : 'crosshair',
        zIndex: 10
      }}
    >
      {/* Prévisualisation suivant la souris (seulement sur page 1 et si pas de tampon sur la pièce) */}
      {mousePos && isFirstPage && !hasStampOnPiece && (
        <canvas
          ref={cursorCanvasRef}
          style={{
            position: 'absolute',
            left: mousePos.x - displayStampRadius * 1.25,
            top: mousePos.y - displayStampRadius * 1.25,
            pointerEvents: 'none',
            opacity: 0.5
          }}
        />
      )}

      {/* Tampons déjà placés sur cette page */}
      {currentPlacements.map((p, i) => {
        const screenPos = pdfToScreen(
          p.x,
          p.y,
          pdfPageWidth,
          pdfPageHeight,
          displayWidth,
          displayHeight
        )
        return (
          <PlacedStamp
            key={i}
            x={screenPos.x}
            y={screenPos.y}
            radius={displayStampRadius}
            lawyerName={lawyerName}
            bottomText={bottomText}
            number={p.number}
          />
        )
      })}
    </div>
  )
}

function PlacedStamp({
  x,
  y,
  radius,
  lawyerName,
  bottomText,
  number
}: {
  x: number
  y: number
  radius: number
  lawyerName: string
  bottomText: string
  number: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = radius * 2.5

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
    ctx.globalAlpha = 0.8
    drawStampOnCanvas(
      ctx,
      size / 2,
      size / 2,
      radius,
      lawyerName || 'NOM AVOCAT',
      bottomText || 'AVOCAT',
      number
    )
  }, [radius, lawyerName, bottomText, number, size])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        pointerEvents: 'none'
      }}
    />
  )
}
