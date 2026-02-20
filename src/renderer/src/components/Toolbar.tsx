interface ToolbarProps {
  hasPieces: boolean
  hasStamps: boolean
  onAddFiles: () => void
  onExportAll: () => void
  onPrintAll: () => void
  onUndo: () => void
  onClearStamps: () => void
  isExporting: boolean
  isPrinting: boolean
  totalPieces: number
  totalStamps: number
}

export function Toolbar({
  hasPieces,
  hasStamps,
  onAddFiles,
  onExportAll,
  onPrintAll,
  onUndo,
  onClearStamps,
  isExporting,
  isPrinting,
  totalPieces,
  totalStamps
}: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Barre d'outils"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid #ddd',
        background: '#f8f8f8'
      }}
    >
      <button onClick={onAddFiles} style={btnStyle}>
        &#128194; Ajouter des pi&egrave;ces
      </button>

      {hasPieces && (
        <>
          <div style={{ width: 1, height: 24, background: '#ddd' }} />

          <button
            onClick={onUndo}
            disabled={!hasStamps}
            style={btnStyle}
            title="Annuler le dernier tampon"
          >
            &#8617; Annuler
          </button>

          <button
            onClick={onClearStamps}
            disabled={!hasStamps}
            style={{ ...btnStyle, color: hasStamps ? '#c00' : '#999' }}
            title="Supprimer tous les tampons de la pi\u00e8ce active"
          >
            &#10060; Effacer tampons
          </button>

          <div style={{ flex: 1 }} />

          <span aria-live="polite" style={{ fontSize: 12, color: '#666' }}>
            {totalPieces} pi&egrave;ce(s) &middot; {totalStamps} tampon(s) au total
          </span>

          <button
            onClick={onPrintAll}
            disabled={isPrinting || isExporting}
            style={{
              ...btnStyle,
              background: hasPieces && !isPrinting ? '#059669' : '#ccc',
              color: '#fff',
              fontWeight: 600
            }}
          >
            {isPrinting ? 'Impression...' : '\u{1F5A8} Imprimer tout'}
          </button>

          <button
            onClick={onExportAll}
            disabled={isExporting}
            style={{
              ...btnStyle,
              background: hasPieces ? '#2563eb' : '#ccc',
              color: '#fff',
              fontWeight: 600
            }}
          >
            {isExporting ? 'Exportation...' : '\u{1F4BE} Exporter toutes les pi\u00e8ces'}
          </button>
        </>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #ccc',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap'
}
