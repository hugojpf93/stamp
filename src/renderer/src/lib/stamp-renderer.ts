/**
 * Calcule la taille de police maximale pour que le texte tienne dans un arc.
 * Reduit progressivement la taille si le texte depasse l'angle maximum autorise.
 */
function fitFontSizeCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxFontSize: number,
  radius: number,
  maxAngle: number
): number {
  let fontSize = maxFontSize
  const chars = [...text]
  for (let attempt = 0; attempt < 20; attempt++) {
    ctx.font = `bold ${fontSize}px "Times New Roman", serif`
    const spacing = fontSize * 0.08
    const totalWidth =
      chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) + spacing * (chars.length - 1)
    const totalAngle = totalWidth / radius
    if (totalAngle <= maxAngle) break
    fontSize *= 0.9
  }
  return fontSize
}

/**
 * Dessine un tampon d'avocat sur un contexte Canvas 2D.
 * Deux cercles concentriques, nom courbé en haut, barreau en bas, numéro au centre.
 */
export function drawStampOnCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  lawyerName: string,
  bottomText: string,
  stampNumber: number
): void {
  const color = '#000000'
  const innerRadius = outerRadius * 0.65
  const bandCenter = (outerRadius + innerRadius) / 2

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color

  // 1. Cercle extérieur
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2)
  ctx.stroke()

  // 2. Cercle intérieur
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
  ctx.stroke()

  // 3. Nom de l'avocat en haut (texte courbé)
  const topText = lawyerName.toUpperCase()
  const topFontSize = fitFontSizeCanvas(ctx, topText, outerRadius * 0.20, bandCenter, Math.PI * 1.4)
  drawCurvedTextOnCanvas(ctx, topText, cx, cy, bandCenter, topFontSize, true)

  // 4. Texte en bas (personnalisable)
  const bottomDisplay = bottomText.toUpperCase()
  const bottomFontSize = fitFontSizeCanvas(
    ctx,
    bottomDisplay,
    outerRadius * 0.15,
    bandCenter,
    Math.PI * 1.4
  )
  drawCurvedTextOnCanvas(ctx, bottomDisplay, cx, cy, bandCenter, bottomFontSize, false)

  // 5. Numéro au centre
  const numStr = String(stampNumber)
  const numFontSize = outerRadius * 0.45
  ctx.font = `bold ${numFontSize}px "Times New Roman", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(numStr, cx, cy)

  ctx.restore()
}

function drawCurvedTextOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  fontSize: number,
  isTop: boolean
): void {
  ctx.font = `bold ${fontSize}px "Times New Roman", serif`

  const chars = [...text]
  const charWidths = chars.map((c) => ctx.measureText(c).width)

  // Ajouter un petit espacement entre chaque caractere pour reguler l'espacement
  const spacing = fontSize * 0.08
  const totalWidth = charWidths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  const totalAngle = totalWidth / radius

  if (isTop) {
    // Arc superieur : centre sur -PI/2 (haut du cercle en Canvas)
    let currentAngle = -Math.PI / 2 - totalAngle / 2

    for (let i = 0; i < chars.length; i++) {
      const charAngle = (charWidths[i] + spacing) / radius
      currentAngle += charAngle / 2

      ctx.save()
      ctx.translate(cx + radius * Math.cos(currentAngle), cy + radius * Math.sin(currentAngle))
      ctx.rotate(currentAngle + Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(chars[i], 0, 0)
      ctx.restore()

      currentAngle += charAngle / 2
    }
  } else {
    // Arc inferieur : centre sur PI/2 (bas du cercle en Canvas)
    let currentAngle = Math.PI / 2 + totalAngle / 2

    for (let i = 0; i < chars.length; i++) {
      const charAngle = (charWidths[i] + spacing) / radius
      currentAngle -= charAngle / 2

      ctx.save()
      ctx.translate(cx + radius * Math.cos(currentAngle), cy + radius * Math.sin(currentAngle))
      ctx.rotate(currentAngle - Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(chars[i], 0, 0)
      ctx.restore()

      currentAngle -= charAngle / 2
    }
  }
}
