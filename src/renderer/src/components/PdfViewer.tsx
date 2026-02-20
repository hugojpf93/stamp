import { useState, useCallback, useMemo, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configurer le worker pdf.js via CDN (evite les problemes de chemins avec espaces)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

interface PdfViewerProps {
  pdfBuffer: Uint8Array
  currentPage: number
  onTotalPages: (total: number) => void
  onPageDimensions: (
    pdfWidth: number,
    pdfHeight: number,
    displayWidth: number,
    displayHeight: number
  ) => void
  children?: React.ReactNode
}

export function PdfViewer({
  pdfBuffer,
  currentPage,
  onTotalPages,
  onPageDimensions,
  children
}: PdfViewerProps) {
  const [containerWidth] = useState(700)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)

  const fileData = useMemo(() => {
    const copy = new Uint8Array(pdfBuffer)
    return { data: copy }
  }, [pdfBuffer])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setLoadError(null)
      onTotalPages(numPages)
    },
    [onTotalPages]
  )

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Erreur chargement PDF:', error)
    setLoadError(error.message)
  }, [])

  const onPageRenderSuccess = useCallback(
    (page: { originalWidth: number; originalHeight: number; width: number; height: number }) => {
      // originalWidth/Height = dimensions CropBox/MediaBox du PDF en points (AVANT rotation)
      // page.width/height = AUSSI les dimensions brutes × scale (AVANT rotation) — inutiles pour la taille visuelle
      //
      // Pour obtenir les dimensions VISUELLES réelles du rendu (après rotation),
      // on mesure directement le canvas dans le DOM. C'est la seule source fiable
      // car react-pdf utilise getViewport() (qui tient compte de /Rotate) pour le canvas.
      const canvas = pageContainerRef.current?.querySelector('canvas')
      let actualDisplayW: number
      let actualDisplayH: number

      if (canvas) {
        // Le canvas DOM a les dimensions visuelles réelles (après rotation)
        actualDisplayW = canvas.clientWidth || canvas.offsetWidth
        actualDisplayH = canvas.clientHeight || canvas.offsetHeight
      } else {
        // Fallback si le canvas n'est pas trouvé
        actualDisplayW = page.width
        actualDisplayH = page.height
      }

      // Detecter la rotation en comparant le ratio des dimensions brutes
      // avec le ratio des dimensions visuelles du canvas
      const rawRatio = page.originalWidth / page.originalHeight
      const canvasRatio = actualDisplayW / actualDisplayH

      let visualPdfWidth: number
      let visualPdfHeight: number

      // Si les ratios sont similaires, pas de rotation (ou 180°)
      // Si les ratios sont inversés (~1/rawRatio), rotation 90° ou 270°
      if (Math.abs(rawRatio - canvasRatio) < 0.01) {
        // Meme ratio → pas de rotation (ou 180°) → dimensions directes
        visualPdfWidth = page.originalWidth
        visualPdfHeight = page.originalHeight
      } else {
        // Ratio inversé → rotation 90° ou 270° → swap dimensions PDF
        visualPdfWidth = page.originalHeight
        visualPdfHeight = page.originalWidth
      }

      setRenderedSize({ w: actualDisplayW, h: actualDisplayH })
      onPageDimensions(visualPdfWidth, visualPdfHeight, actualDisplayW, actualDisplayH)
    },
    [onPageDimensions]
  )

  return (
    <div
      ref={pageContainerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        border: '1px solid #ddd',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Document
        file={fileData}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={<div style={{ padding: 40 }}>Chargement du PDF...</div>}
        error={
          <div role="alert" style={{ padding: 40, color: 'red' }}>
            Erreur de chargement du PDF
            {loadError && <div style={{ fontSize: 12, marginTop: 8 }}>{loadError}</div>}
          </div>
        }
      >
        <Page
          pageNumber={currentPage}
          width={containerWidth}
          onRenderSuccess={onPageRenderSuccess}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
      {/* L'overlay se superpose exactement au rendu de la page */}
      {renderedSize && children}
    </div>
  )
}
