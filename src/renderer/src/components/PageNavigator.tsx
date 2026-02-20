interface PageNavigatorProps {
  currentPage: number
  totalPages: number
  onPrevPage: () => void
  onNextPage: () => void
  onGoToPage: (page: number) => void
}

export function PageNavigator({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onGoToPage
}: PageNavigatorProps) {
  return (
    <nav
      role="navigation"
      aria-label="Navigation des pages"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 0'
      }}
    >
      <button
        onClick={onPrevPage}
        disabled={currentPage <= 1}
        style={btnStyle}
        title="Page pr&eacute;c&eacute;dente"
      >
        &#9664; Pr&eacute;c&eacute;dent
      </button>

      <span style={{ fontSize: 14, minWidth: 120, textAlign: 'center' }}>
        Page{' '}
        <input
          type="number"
          aria-label="Numéro de page"
          value={currentPage}
          min={1}
          max={totalPages}
          onChange={(e) => onGoToPage(parseInt(e.target.value) || 1)}
          style={{
            width: 50,
            textAlign: 'center',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '2px 4px'
          }}
        />{' '}
        / {totalPages}
      </span>

      <button
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
        style={btnStyle}
        title="Page suivante"
      >
        Suivant &#9654;
      </button>
    </nav>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #ccc',
  borderRadius: 6,
  background: '#f5f5f5',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
}
