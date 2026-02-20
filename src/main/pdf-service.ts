import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { execFile, execSync } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { readFile } from 'fs/promises'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { join, basename } from 'path'

const execFileAsync = promisify(execFile)

/**
 * Trouve le chemin de soffice.exe sur le système.
 * Cherche dans le PATH, le registre Windows, et les emplacements courants.
 */
function findSofficePath(): string | null {
  // 1. Tenter via le PATH système
  try {
    const result = execSync('where soffice', { encoding: 'utf-8', timeout: 5000 }).trim()
    if (result) return result.split('\n')[0].trim()
  } catch {
    // pas dans le PATH
  }

  // 2. Tenter via le registre Windows (recherche récursive, indépendante de la version)
  try {
    const regResult = execSync('reg query "HKLM\\SOFTWARE\\LibreOffice\\LibreOffice" /s /v Path', {
      encoding: 'utf-8',
      timeout: 5000
    }).trim()
    const match = regResult.match(/Path\s+REG_SZ\s+(.+)/i)
    if (match) {
      const candidate = join(match[1].trim(), 'soffice.exe')
      if (existsSync(candidate)) return candidate
    }
  } catch {
    // clé registre absente
  }

  // 3. Chemins d'installation courants
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

interface StampConfig {
  lawyerName: string
  bottomText: string
  radius: number
}

interface StampPlacement {
  pageIndex: number
  x: number
  y: number
  number: number
}

/**
 * Convertit un buffer image (JPEG, PNG, etc.) en PDF d'une seule page.
 */
export async function convertImageToPdf(imageBuffer: Buffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  let image
  // Tester si c'est un JPEG (commence par FF D8)
  if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
    image = await pdfDoc.embedJpg(imageBuffer)
  } else {
    // Sinon traiter comme PNG
    image = await pdfDoc.embedPng(imageBuffer)
  }

  const { width: imgW, height: imgH } = image.scale(1)

  // Dimensions A4 en points PDF (72 dpi)
  const A4_W = 595.28
  const A4_H = 841.89

  // Choisir l'orientation de la page selon l'image
  const isLandscape = imgW > imgH
  const pageW = isLandscape ? A4_H : A4_W
  const pageH = isLandscape ? A4_W : A4_H

  // Redimensionner l'image pour tenir dans la page A4 en conservant le ratio
  const scale = Math.min(pageW / imgW, pageH / imgH)
  const drawW = imgW * scale
  const drawH = imgH * scale

  // Centrer l'image sur la page
  const x = (pageW - drawW) / 2
  const y = (pageH - drawH) / 2

  const page = pdfDoc.addPage([pageW, pageH])
  page.drawImage(image, { x, y, width: drawW, height: drawH })

  return await pdfDoc.save()
}

/**
 * Calcule la taille de police maximale pour que le texte tienne dans un arc.
 * Reduit progressivement la taille si le texte depasse l'angle maximum autorise.
 */
function fitFontSize(
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  maxFontSize: number,
  radius: number,
  maxAngle: number
): number {
  let fontSize = maxFontSize
  const chars = Array.from(text)
  for (let attempt = 0; attempt < 20; attempt++) {
    const spacing = fontSize * 0.08
    const totalWidth =
      chars.reduce((sum, c) => sum + font.widthOfTextAtSize(c, fontSize), 0) +
      spacing * (chars.length - 1)
    const totalAngle = totalWidth / radius
    if (totalAngle <= maxAngle) break
    fontSize *= 0.9
  }
  return fontSize
}

/**
 * Dessine un tampon (deux cercles concentriques + texte courbe + numero) sur une page PDF.
 */
async function drawStampOnPage(
  page: ReturnType<PDFDocument['getPage']>,
  pdfDoc: PDFDocument,
  cx: number,
  cy: number,
  outerRadius: number,
  lawyerName: string,
  bottomText: string,
  stampNumber: number
): Promise<void> {
  const color = rgb(0, 0, 0)
  const innerRadius = outerRadius * 0.65
  const bandCenter = (outerRadius + innerRadius) / 2

  // 1. Cercle exterieur
  page.drawCircle({
    x: cx,
    y: cy,
    size: outerRadius,
    borderColor: color,
    borderWidth: 1.5,
    opacity: 0,
    borderOpacity: 1
  })

  // 2. Cercle interieur
  page.drawCircle({
    x: cx,
    y: cy,
    size: innerRadius,
    borderColor: color,
    borderWidth: 1,
    opacity: 0,
    borderOpacity: 1
  })

  // 3. Police (bold pour tout le texte du tampon)
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  // 4. Texte courbe en haut : nom de l'avocat (bold)
  const topText = lawyerName.toUpperCase()
  const topFontSize = fitFontSize(boldFont, topText, outerRadius * 0.20, bandCenter, Math.PI * 1.4)
  drawCurvedText(page, boldFont, topText, topFontSize, cx, cy, bandCenter, color, true)

  // 5. Texte courbe en bas (personnalisable, bold)
  const bottomDisplay = bottomText.toUpperCase()
  const bottomFontSize = fitFontSize(
    boldFont,
    bottomDisplay,
    outerRadius * 0.15,
    bandCenter,
    Math.PI * 1.4
  )
  drawCurvedText(page, boldFont, bottomDisplay, bottomFontSize, cx, cy, bandCenter, color, false)

  // 6. Numero au centre
  const numStr = String(stampNumber)
  const numFontSize = outerRadius * 0.45
  const numWidth = boldFont.widthOfTextAtSize(numStr, numFontSize)
  page.drawText(numStr, {
    x: cx - numWidth / 2,
    y: cy - numFontSize / 3,
    size: numFontSize,
    font: boldFont,
    color
  })
}

/**
 * Dessine du texte courbe le long d'un arc de cercle.
 * En PDF, l'origine est en bas-gauche, Y va vers le haut.
 * PI/2 = haut (12h), -PI/2 = bas (6h), 0 = droite (3h), PI = gauche (9h)
 *
 * La logique reproduit exactement le rendu Canvas (stamp-renderer.ts)
 * en tenant compte de l'inversion de l'axe Y (Canvas Y-down vs PDF Y-up).
 *
 * Canvas angle α correspond a PDF angle -α.
 */
function drawCurvedText(
  page: ReturnType<PDFDocument['getPage']>,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  text: string,
  fontSize: number,
  cx: number,
  cy: number,
  radius: number,
  color: ReturnType<typeof rgb>,
  isTop: boolean
): void {
  const chars = Array.from(text)
  const charWidths = chars.map((c) => font.widthOfTextAtSize(c, fontSize))

  // Espacement entre caracteres (identique au Canvas)
  const spacing = fontSize * 0.08
  const totalWidth = charWidths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  const totalAngle = totalWidth / radius

  // Demi-hauteur pour centrer verticalement les glyphes sur l'arc.
  // pdf-lib drawText positionne au coin baseline-left → on doit compenser.
  // Cap height des majuscules Times-Roman ≈ 0.66 × fontSize → demi = 0.33
  const halfCapHeight = fontSize * 0.33

  if (isTop) {
    // Arc superieur : centré sur PI/2 (haut, 12h)
    let currentAngle = Math.PI / 2 + totalAngle / 2

    for (let i = 0; i < chars.length; i++) {
      const charAngle = (charWidths[i] + spacing) / radius
      currentAngle -= charAngle / 2

      // Point sur l'arc où le CENTRE du caractère doit atterrir
      const px = cx + radius * Math.cos(currentAngle)
      const py = cy + radius * Math.sin(currentAngle)

      // Rotation du caractère : tête vers l'extérieur
      const rotDeg = (currentAngle * 180) / Math.PI - 90
      const rotRad = currentAngle - Math.PI / 2

      // Le centre du glyphe en espace local (depuis baseline-left) est à (halfW, halfH).
      // Après rotation de rotRad, ce décalage en coordonnées monde :
      const halfW = charWidths[i] / 2
      const halfH = halfCapHeight
      const centerOffsetX = halfW * Math.cos(rotRad) - halfH * Math.sin(rotRad)
      const centerOffsetY = halfW * Math.sin(rotRad) + halfH * Math.cos(rotRad)

      page.drawText(chars[i], {
        x: px - centerOffsetX,
        y: py - centerOffsetY,
        size: fontSize,
        font,
        color,
        rotate: degrees(rotDeg)
      })

      currentAngle -= charAngle / 2
    }
  } else {
    // Arc inferieur : centré sur -PI/2 (bas, 6h)
    // Lettres tête vers le centre, lisibles de gauche à droite
    let currentAngle = -Math.PI / 2 - totalAngle / 2

    for (let i = 0; i < chars.length; i++) {
      const charAngle = (charWidths[i] + spacing) / radius
      currentAngle += charAngle / 2

      const px = cx + radius * Math.cos(currentAngle)
      const py = cy + radius * Math.sin(currentAngle)

      // Rotation du caractère : tête vers le centre (inversé)
      const rotDeg = (currentAngle * 180) / Math.PI + 90
      const rotRad = currentAngle + Math.PI / 2

      const halfW = charWidths[i] / 2
      const halfH = halfCapHeight
      const centerOffsetX = halfW * Math.cos(rotRad) - halfH * Math.sin(rotRad)
      const centerOffsetY = halfW * Math.sin(rotRad) + halfH * Math.cos(rotRad)

      page.drawText(chars[i], {
        x: px - centerOffsetX,
        y: py - centerOffsetY,
        size: fontSize,
        font,
        color,
        rotate: degrees(rotDeg)
      })

      currentAngle += charAngle / 2
    }
  }
}

/**
 * Applique tous les tampons sur un PDF et retourne le PDF modifie.
 *
 * Approche robuste pour gérer les pages pivotées (/Rotate ≠ 0) :
 *
 * Problème : quand un PDF a /Rotate = 90, pdf-lib dessine dans l'espace brut
 * (avant rotation) mais le viewer PDF pivote TOUT le contenu de la page,
 * y compris nos tampons → les tampons apparaissent tournés de 90°.
 *
 * Solution : on reconstruit les pages pivotées en utilisant embedPage() :
 * 1. On embarque la page originale comme Form XObject
 * 2. On crée une nouvelle page vide avec les dimensions VISUELLES (après rotation)
 * 3. On dessine la page embarquée avec la rotation appropriée pour reproduire
 *    le rendu visuel original
 * 4. On dessine le tampon directement en coordonnées visuelles (screenToPdf)
 * 5. La nouvelle page n'a PAS de /Rotate → les tampons ne sont pas pivotés
 *
 * Pour les pages sans rotation, on dessine directement le tampon.
 *
 * drawPage operation order: translate(x,y) → rotate(angle) → scale → drawObject
 * Point (px,py) in XObject → after rotate θ: (px·cosθ − py·sinθ, px·sinθ + py·cosθ)
 *                           → after translate: (tx + ..., ty + ...)
 *
 * /Rotate=90 (raw W×H, visual H×W):
 *   θ=90° CCW, (px,py)→(tx−py, ty+px)
 *   Need: (0,0)→(tx,ty)=(H,0) and (W,H)→(tx−H, ty+W)=(0,W)
 *   → x=H, y=0
 *
 * /Rotate=180 (raw W×H, visual W×H):
 *   θ=180°, (px,py)→(tx−px, ty−py)
 *   Need: (W,H)→(0,0) → tx=W, ty=H
 *   → x=W, y=H
 *
 * /Rotate=270 (raw W×H, visual H×W):
 *   θ=270°, (px,py)→(tx+py, ty−px)
 *   Need: (0,0)→(tx,ty)=(0,H) and (W,H)→(H,H−W)=(H,0)... wait no
 *   (0,H)→(tx+H, ty)=(H,0) → tx=0, ty=0... (W,0)→(tx, ty−W)=(0,−W) non
 *   Recalcul: cos270=0, sin270=−1
 *   (px,py)→(tx + py, ty − px)
 *   (0,0)→(tx, ty)  (W,0)→(tx, ty−W)  (0,H)→(tx+H, ty)  (W,H)→(tx+H, ty−W)
 *   Need in [0,H]×[0,W]: min_x=0→tx=0, max_x=H→tx+H=H✓
 *   min_y=0→ty−W=0→ty=W, max_y=W→ty=W✓
 *   → x=0, y=W=visualH
 */
export async function applyStamps(
  pdfBuffer: Uint8Array,
  placements: StampPlacement[],
  config: StampConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)

  // Regrouper les placements par page
  const placementsByPage = new Map<number, StampPlacement[]>()
  for (const p of placements) {
    const list = placementsByPage.get(p.pageIndex) || []
    list.push(p)
    placementsByPage.set(p.pageIndex, list)
  }

  // Trier les indices de pages par ordre décroissant pour eviter
  // les décalages d'index lors des insertions/suppressions
  const sortedPageIndices = Array.from(placementsByPage.keys()).sort((a, b) => b - a)

  // Charger une copie séparée du PDF uniquement si des pages rotées nécessitent
  // un embedding (évite de doubler la mémoire pour les PDF sans rotation)
  const hasRotatedPages = sortedPageIndices.some((idx) => {
    const page = pdfDoc.getPage(idx)
    return page.getRotation().angle !== 0
  })
  const srcDoc = hasRotatedPages ? await PDFDocument.load(pdfBuffer) : null

  for (const pageIndex of sortedPageIndices) {
    const pagePlacements = placementsByPage.get(pageIndex)!
    const page = pdfDoc.getPage(pageIndex)
    const rotation = page.getRotation().angle

    // Adapter le rayon du tampon proportionnellement à la taille de la page.
    // Le rayon de référence (config.radius = 65) est calibré pour A4 portrait (largeur ~595pt).
    // Pour des pages plus grandes ou plus petites, on adapte.
    const { width: pageW, height: pageH } = page.getSize()
    const pageShortSide = Math.min(pageW, pageH)
    const A4_SHORT = 595.28
    const scaledRadius = config.radius * (pageShortSide / A4_SHORT)

    if (rotation === 0) {
      // Pas de rotation : dessiner directement
      for (const placement of pagePlacements) {
        await drawStampOnPage(
          page,
          pdfDoc,
          placement.x,
          placement.y,
          scaledRadius,
          config.lawyerName,
          config.bottomText,
          placement.number
        )
      }
    } else {
      // Page pivotée : reconstruire sans rotation
      const { width: rawW, height: rawH } = page.getSize()
      const isSwapped = rotation === 90 || rotation === 270
      const visualW = isSwapped ? rawH : rawW
      const visualH = isSwapped ? rawW : rawH

      // Embarquer la page depuis le document SOURCE (contexte différent → copie propre)
      const srcPage = srcDoc!.getPage(pageIndex)
      const [embeddedPage] = await pdfDoc.embedPages([srcPage])

      // Supprimer l'ancienne page et insérer la nouvelle aux dimensions visuelles
      pdfDoc.removePage(pageIndex)
      const newPage = pdfDoc.insertPage(pageIndex, [visualW, visualH])

      // Dessiner la page embarquée avec rotation pour reproduire le rendu visuel.
      //
      // /Rotate dans le standard PDF = rotation CW pour l'affichage
      // degrees() de pdf-lib = sens mathématique CCW
      // drawPage: translate(x,y) → rotate(θ) → scale → drawXObject
      //
      // Pour /Rotate=90 (CW) on utilise degrees(-90) :
      //   θ=-90°, cos=0, sin=-1
      //   brut(bx,by) → flat(tx+by, ty-bx)
      //   Avec tx=0, ty=rawW : flat(by, rawW-bx) → dans [0,rawH]×[0,rawW] = [0,visualW]×[0,visualH] ✓
      switch (rotation) {
        case 90:
          newPage.drawPage(embeddedPage, { x: 0, y: rawW, rotate: degrees(-90) })
          break
        case 180:
          newPage.drawPage(embeddedPage, { x: rawW, y: rawH, rotate: degrees(-180) })
          break
        case 270:
          newPage.drawPage(embeddedPage, { x: rawH, y: 0, rotate: degrees(90) })
          break
        default:
          // Rotation non standard (ex: 45°) — dessiner sans transformation
          console.warn(`Rotation PDF non standard ignorée: ${rotation}°`)
          newPage.drawPage(embeddedPage)
          break
      }

      // Recalculer le rayon pour la page reconstruite (dimensions visuelles)
      const visualShortSide = Math.min(visualW, visualH)
      const scaledRadiusRotated = config.radius * (visualShortSide / A4_SHORT)

      // Dessiner les tampons en coordonnées visuelles directement
      for (const placement of pagePlacements) {
        await drawStampOnPage(
          newPage,
          pdfDoc,
          placement.x,
          placement.y,
          scaledRadiusRotated,
          config.lawyerName,
          config.bottomText,
          placement.number
        )
      }
    }
  }

  return await pdfDoc.save()
}

/**
 * Convertit un fichier DOCX/DOC en PDF en utilisant LibreOffice (prioritaire) ou Word (fallback).
 * Nécessite que l'un des deux soit installé sur le PC.
 *
 * Gère les cas suivants :
 * - LibreOffice installé dans un chemin non standard (registre + PATH + chemins courants)
 * - Instance LibreOffice déjà ouverte (profil utilisateur temporaire dédié)
 * - Noms de fichiers avec espaces ou caractères spéciaux
 * - Nettoyage du processus Word en cas d'erreur
 */
export async function convertDocxToPdf(docxPath: string): Promise<Uint8Array> {
  // Dossier temporaire unique pour éviter les conflits entre conversions parallèles
  const conversionDir = mkdtempSync(join(tmpdir(), 'stamp-docx-'))

  // LibreOffice génère le PDF avec le même nom de base que le fichier source
  const rawExt = docxPath.toLowerCase().endsWith('.docx') ? '.docx' : '.doc'
  const baseName = basename(docxPath, rawExt)
  const pdfPath = join(conversionDir, `${baseName}.pdf`)

  try {
    // --- Tentative 1 : LibreOffice ---
    const sofficePath = findSofficePath()
    if (sofficePath) {
      // Tentative avec profil temporaire (permet de convertir même si LO est ouvert)
      const userProfile = `file:///${conversionDir.replace(/\\/g, '/').replace(/ /g, '%20')}/profile`
      const argsWithProfile = [
        `-env:UserInstallation=${userProfile}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        conversionDir,
        docxPath
      ]
      // Fallback sans profil temporaire (fonctionne si aucune instance LO n'est ouverte)
      const argsWithoutProfile = [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        conversionDir,
        docxPath
      ]

      for (const args of [argsWithProfile, argsWithoutProfile]) {
        try {
          await execFileAsync(sofficePath, args, { timeout: 60000 })
          if (existsSync(pdfPath)) {
            const pdfBuffer = await readFile(pdfPath)
            return new Uint8Array(pdfBuffer)
          }
        } catch {
          // Continuer avec la tentative suivante
        }
      }
    }

    // --- Tentative 2 : Word via PowerShell COM Automation ---
    // Les chemins sont injectés dans le script avec échappement single-quote
    // (en PowerShell, ' dans une single-quoted string s'échappe en '')
    const escapedDocxPath = docxPath.replace(/'/g, "''")
    const escapedPdfPath = pdfPath.replace(/'/g, "''")
    const psScript = `
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open('${escapedDocxPath}')
  $doc.SaveAs2([ref]'${escapedPdfPath}', [ref]17)
  $doc.Close([ref]0)
} finally {
  if ($word) {
    try { $word.Quit() } catch {}
    try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
  }
}
`
    try {
      await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        timeout: 60000
      })

      const pdfBuffer = await readFile(pdfPath)
      return new Uint8Array(pdfBuffer)
    } catch {
      // Word aussi a échoué
    }

    throw new Error('Conversion DOCX impossible. Veuillez installer LibreOffice ou Microsoft Word.')
  } finally {
    // Nettoyage du dossier temporaire
    try {
      rmSync(conversionDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fusionne deux PDF en un seul (les pages du 2ème PDF sont ajoutées à la fin du 1er).
 */
export async function mergePdfs(buffer1: Uint8Array, buffer2: Uint8Array): Promise<Uint8Array> {
  const doc1 = await PDFDocument.load(buffer1)
  const doc2 = await PDFDocument.load(buffer2)

  // Copier toutes les pages de doc2 dans doc1
  const pages2 = await doc1.copyPages(doc2, doc2.getPageIndices())
  for (const page of pages2) {
    doc1.addPage(page)
  }

  return await doc1.save()
}

/**
 * Scinde un PDF en deux parties après la page indiquée (0-based).
 * afterPageIndex = 0 → part1 = page 0, part2 = pages 1..fin
 */
export async function splitPdf(
  buffer: Uint8Array,
  afterPageIndex: number
): Promise<{ part1: Uint8Array; part2: Uint8Array }> {
  const srcDoc = await PDFDocument.load(buffer)
  const totalPages = srcDoc.getPageCount()

  // Créer part1 : pages 0..afterPageIndex
  const doc1 = await PDFDocument.create()
  const indices1 = Array.from({ length: afterPageIndex + 1 }, (_, i) => i)
  const pages1 = await doc1.copyPages(srcDoc, indices1)
  for (const page of pages1) {
    doc1.addPage(page)
  }

  // Créer part2 : pages (afterPageIndex+1)..fin
  const doc2 = await PDFDocument.create()
  const indices2 = Array.from(
    { length: totalPages - afterPageIndex - 1 },
    (_, i) => afterPageIndex + 1 + i
  )
  const pages2 = await doc2.copyPages(srcDoc, indices2)
  for (const page of pages2) {
    doc2.addPage(page)
  }

  return {
    part1: await doc1.save(),
    part2: await doc2.save()
  }
}
