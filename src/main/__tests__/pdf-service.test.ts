import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { convertImageToPdf, mergePdfs, splitPdf, applyStamps } from '../pdf-service'

/**
 * Crée un petit PNG valide en mémoire (1x1 pixel rouge).
 */
function createMinimalPng(): Buffer {
  // PNG minimal 1x1 pixel rouge (RGBA)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  )
  return png
}

/**
 * Crée un PDF vierge avec N pages.
 */
async function createBlankPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([595.28, 841.89]) // A4
  }
  return doc.save()
}

describe('convertImageToPdf', () => {
  it('converts a PNG image to a single-page PDF', async () => {
    const png = createMinimalPng()
    const pdfBytes = await convertImageToPdf(png)

    expect(pdfBytes).toBeInstanceOf(Uint8Array)
    expect(pdfBytes.length).toBeGreaterThan(0)

    // Verify it's a valid PDF with 1 page
    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBe(1)
  })
})

describe('mergePdfs', () => {
  it('merges two single-page PDFs into a 2-page PDF', async () => {
    const pdf1 = await createBlankPdf(1)
    const pdf2 = await createBlankPdf(1)

    const merged = await mergePdfs(pdf1, pdf2)
    const doc = await PDFDocument.load(merged)
    expect(doc.getPageCount()).toBe(2)
  })

  it('merges a 2-page and a 1-page PDF into a 3-page PDF', async () => {
    const pdf1 = await createBlankPdf(2)
    const pdf2 = await createBlankPdf(1)

    const merged = await mergePdfs(pdf1, pdf2)
    const doc = await PDFDocument.load(merged)
    expect(doc.getPageCount()).toBe(3)
  })
})

describe('splitPdf', () => {
  it('splits a 3-page PDF after page 0 into 1+2', async () => {
    const pdf = await createBlankPdf(3)
    const { part1, part2 } = await splitPdf(pdf, 0)

    const doc1 = await PDFDocument.load(part1)
    const doc2 = await PDFDocument.load(part2)
    expect(doc1.getPageCount()).toBe(1)
    expect(doc2.getPageCount()).toBe(2)
  })

  it('splits a 3-page PDF after page 1 into 2+1', async () => {
    const pdf = await createBlankPdf(3)
    const { part1, part2 } = await splitPdf(pdf, 1)

    const doc1 = await PDFDocument.load(part1)
    const doc2 = await PDFDocument.load(part2)
    expect(doc1.getPageCount()).toBe(2)
    expect(doc2.getPageCount()).toBe(1)
  })
})

describe('applyStamps', () => {
  it('applies a stamp on a blank PDF and produces a valid PDF', async () => {
    const pdf = await createBlankPdf(1)
    const placements = [{ pageIndex: 0, x: 297, y: 420, number: 1 }]
    const config = { lawyerName: 'Me Test', barCity: 'Paris', radius: 65 }

    const stamped = await applyStamps(pdf, placements, config)
    expect(stamped).toBeInstanceOf(Uint8Array)
    expect(stamped.length).toBeGreaterThan(pdf.length)

    // Verify it's still a valid single-page PDF
    const doc = await PDFDocument.load(stamped)
    expect(doc.getPageCount()).toBe(1)
  })

  it('returns unchanged PDF when no placements', async () => {
    const pdf = await createBlankPdf(1)
    const stamped = await applyStamps(pdf, [], { lawyerName: '', barCity: '', radius: 65 })

    // The PDF should still be valid
    const doc = await PDFDocument.load(stamped)
    expect(doc.getPageCount()).toBe(1)
  })
})
