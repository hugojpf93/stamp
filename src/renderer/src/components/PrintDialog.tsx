import { useState, useEffect, useRef, useCallback } from 'react'
import type { PrinterInfo, PrintSettings } from '../types'

interface PrintDialogProps {
  onPrint: (settings: PrintSettings) => void
  onCancel: () => void
  totalPieces: number
}

export function PrintDialog({ onPrint, onCancel, totalPieces }: PrintDialogProps) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [side, setSide] = useState<'simplex' | 'duplex' | 'duplexshort' | 'duplexlong'>('simplex')
  const [copies, setCopies] = useState(1)
  const [loading, setLoading] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getPrinters().then((list) => {
      setPrinters(list)
      const defaultPrinter = list.find((p) => p.isDefault)
      if (defaultPrinter) {
        setSelectedPrinter(defaultPrinter.name)
      } else if (list.length > 0) {
        setSelectedPrinter(list[0].name)
      }
      setLoading(false)
    })
  }, [])

  // Focus trap : focus le premier élément focusable au mount, boucler Tab, Escape ferme
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const focusableSelector =
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

    // Focus le premier élément focusable après un court délai (attendre le rendu)
    const timer = setTimeout(() => {
      const first = dialog.querySelector<HTMLElement>(focusableSelector)
      first?.focus()
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key === 'Tab') {
        const focusable = dialog.querySelectorAll<HTMLElement>(focusableSelector)
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  const handlePrint = useCallback(() => {
    if (!selectedPrinter) return
    onPrint({ deviceName: selectedPrinter, copies, side })
  }, [selectedPrinter, copies, side, onPrint])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-dialog-title"
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 24,
          width: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="print-dialog-title" style={{ margin: '0 0 16px', fontSize: 18 }}>
          Imprimer {totalPieces} pi&egrave;ce(s)
        </h2>

        <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
          Chaque pi&egrave;ce sera imprim&eacute;e comme un job s&eacute;par&eacute; (pour agrafage
          individuel).
        </p>

        {loading ? (
          <p style={{ color: '#999' }}>Chargement des imprimantes...</p>
        ) : printers.length === 0 ? (
          <p role="alert" style={{ color: '#c00' }}>
            Aucune imprimante d&eacute;tect&eacute;e.
          </p>
        ) : (
          <>
            {/* Imprimante */}
            <label htmlFor="print-printer" style={labelStyle}>
              Imprimante
            </label>
            <select
              id="print-printer"
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              style={selectStyle}
            >
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.displayName || p.name}
                  {p.isDefault ? ' (par d\u00e9faut)' : ''}
                </option>
              ))}
            </select>

            {/* Recto-verso */}
            <label htmlFor="print-side" style={labelStyle}>
              Recto-verso
            </label>
            <select
              id="print-side"
              value={side}
              onChange={(e) =>
                setSide(e.target.value as 'simplex' | 'duplex' | 'duplexshort' | 'duplexlong')
              }
              style={selectStyle}
            >
              <option value="simplex">Recto uniquement</option>
              <option value="duplexlong">Recto-verso (bord long)</option>
              <option value="duplexshort">Recto-verso (bord court)</option>
            </select>

            {/* Copies */}
            <label htmlFor="print-copies" style={labelStyle}>
              Copies
            </label>
            <input
              id="print-copies"
              type="number"
              min={1}
              max={99}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ ...selectStyle, width: 80 }}
            />

            <div
              style={{
                marginTop: 16,
                padding: 10,
                background: '#f0f7ff',
                borderRadius: 6,
                fontSize: 12,
                color: '#555'
              }}
            >
              L&apos;agrafage se configure dans les pr&eacute;f&eacute;rences de l&apos;imprimante
              Windows (Panneau de configuration &rarr; Imprimantes &rarr; clic droit &rarr;
              Pr&eacute;f&eacute;rences d&apos;impression).
            </div>
          </>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onCancel} style={cancelBtnStyle}>
            Annuler
          </button>
          <button
            onClick={handlePrint}
            disabled={!selectedPrinter || loading}
            style={{
              ...printBtnStyle,
              opacity: !selectedPrinter || loading ? 0.5 : 1
            }}
          >
            Imprimer
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#333',
  marginBottom: 4,
  marginTop: 12
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #ccc',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit'
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  border: '1px solid #ccc',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
}

const printBtnStyle: React.CSSProperties = {
  padding: '8px 18px',
  border: 'none',
  borderRadius: 6,
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit'
}
