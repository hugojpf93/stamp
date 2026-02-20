/**
 * Convertit les coordonnées écran (clic souris) en coordonnées PDF.
 * Le PDF a son origine en bas à gauche, tandis que l'écran a son origine en haut à gauche.
 */
export function screenToPdf(
  mouseX: number,
  mouseY: number,
  containerRect: DOMRect,
  pdfPageWidth: number,
  pdfPageHeight: number,
  displayWidth: number,
  displayHeight: number
): { x: number; y: number } {
  // Position relative au conteneur
  const relX = mouseX - containerRect.left
  const relY = mouseY - containerRect.top

  // Normaliser entre 0 et 1
  const normX = relX / displayWidth
  const normY = relY / displayHeight

  // Convertir en coordonnées PDF (Y inversé)
  return {
    x: normX * pdfPageWidth,
    y: (1 - normY) * pdfPageHeight
  }
}

/**
 * Convertit les coordonnées PDF en coordonnées d'affichage (pour positionner les éléments à l'écran).
 */
export function pdfToScreen(
  pdfX: number,
  pdfY: number,
  pdfPageWidth: number,
  pdfPageHeight: number,
  displayWidth: number,
  displayHeight: number
): { x: number; y: number } {
  const normX = pdfX / pdfPageWidth
  const normY = pdfY / pdfPageHeight

  return {
    x: normX * displayWidth,
    y: (1 - normY) * displayHeight
  }
}
