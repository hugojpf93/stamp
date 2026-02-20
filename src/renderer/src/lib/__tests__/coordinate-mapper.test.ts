import { describe, it, expect } from 'vitest'
import { screenToPdf, pdfToScreen } from '../coordinate-mapper'

// Simule un DOMRect pour les tests
function makeRect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect
}

const PDF_W = 595.28
const PDF_H = 841.89
const DISPLAY_W = 700
const DISPLAY_H = 990

describe('screenToPdf', () => {
  const rect = makeRect(100, 50, DISPLAY_W, DISPLAY_H)

  it('converts top-left corner of display to top-left of PDF (high Y)', () => {
    // Click at containerRect.left, containerRect.top → relX=0, relY=0 → PDF (0, pdfH)
    const result = screenToPdf(100, 50, rect, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)
    expect(result.x).toBeCloseTo(0, 1)
    expect(result.y).toBeCloseTo(PDF_H, 1)
  })

  it('converts bottom-right corner of display to bottom-right of PDF (low Y)', () => {
    // Click at containerRect.right, containerRect.bottom → relX=DISPLAY_W, relY=DISPLAY_H → PDF (pdfW, 0)
    const result = screenToPdf(
      100 + DISPLAY_W,
      50 + DISPLAY_H,
      rect,
      PDF_W,
      PDF_H,
      DISPLAY_W,
      DISPLAY_H
    )
    expect(result.x).toBeCloseTo(PDF_W, 1)
    expect(result.y).toBeCloseTo(0, 1)
  })

  it('converts center of display to center of PDF', () => {
    const result = screenToPdf(
      100 + DISPLAY_W / 2,
      50 + DISPLAY_H / 2,
      rect,
      PDF_W,
      PDF_H,
      DISPLAY_W,
      DISPLAY_H
    )
    expect(result.x).toBeCloseTo(PDF_W / 2, 1)
    expect(result.y).toBeCloseTo(PDF_H / 2, 1)
  })
})

describe('pdfToScreen', () => {
  it('converts PDF origin (0,0) to bottom-left of display', () => {
    const result = pdfToScreen(0, 0, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)
    expect(result.x).toBeCloseTo(0, 1)
    expect(result.y).toBeCloseTo(DISPLAY_H, 1)
  })

  it('converts PDF top-right (pdfW, pdfH) to top-right of display', () => {
    const result = pdfToScreen(PDF_W, PDF_H, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)
    expect(result.x).toBeCloseTo(DISPLAY_W, 1)
    expect(result.y).toBeCloseTo(0, 1)
  })

  it('converts PDF center to display center', () => {
    const result = pdfToScreen(PDF_W / 2, PDF_H / 2, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)
    expect(result.x).toBeCloseTo(DISPLAY_W / 2, 1)
    expect(result.y).toBeCloseTo(DISPLAY_H / 2, 1)
  })
})

describe('round-trip: screenToPdf → pdfToScreen', () => {
  const rect = makeRect(0, 0, DISPLAY_W, DISPLAY_H)

  it('round-trips a center click', () => {
    const screenX = DISPLAY_W / 2
    const screenY = DISPLAY_H / 2

    const pdfCoords = screenToPdf(screenX, screenY, rect, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)
    const back = pdfToScreen(pdfCoords.x, pdfCoords.y, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)

    expect(back.x).toBeCloseTo(screenX, 1)
    expect(back.y).toBeCloseTo(screenY, 1)
  })

  it('round-trips an arbitrary point', () => {
    const screenX = 200
    const screenY = 300

    const pdfCoords = screenToPdf(screenX, screenY, rect, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)
    const back = pdfToScreen(pdfCoords.x, pdfCoords.y, PDF_W, PDF_H, DISPLAY_W, DISPLAY_H)

    expect(back.x).toBeCloseTo(screenX, 1)
    expect(back.y).toBeCloseTo(screenY, 1)
  })
})
