import { StampPreview } from './StampPreview'
import type { SavedStamp } from '../types'

interface StampConfiguratorProps {
  lawyerName: string
  bottomText: string
  startNumber: number
  nextNumber: number
  savedStamps: SavedStamp[]
  activeStampId: string | null
  onLawyerNameChange: (name: string) => void
  onBottomTextChange: (text: string) => void
  onStartNumberChange: (num: number) => void
  onSelectStamp: (id: string | null) => void
  onSaveStamp: () => void
  onDeleteStamp: (id: string) => void
}

export function StampConfigurator({
  lawyerName,
  bottomText,
  startNumber,
  nextNumber,
  savedStamps,
  activeStampId,
  onLawyerNameChange,
  onBottomTextChange,
  onStartNumberChange,
  onSelectStamp,
  onSaveStamp,
  onDeleteStamp
}: StampConfiguratorProps) {
  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Configuration du tampon</h3>

      {/* Sélecteur de tampons enregistrés */}
      {savedStamps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="stamp-selector" style={labelStyle}>
            Tampons enregistr&eacute;s
          </label>
          <select
            id="stamp-selector"
            value={activeStampId || ''}
            onChange={(e) => onSelectStamp(e.target.value || null)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">-- Nouveau tampon --</option>
            {savedStamps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="stamp-lawyer-name" style={labelStyle}>
          Nom de l&apos;avocat / Cabinet
        </label>
        <input
          id="stamp-lawyer-name"
          type="text"
          value={lawyerName}
          onChange={(e) => onLawyerNameChange(e.target.value)}
          placeholder="Me Jean Dupont"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="stamp-bottom-text" style={labelStyle}>
          Texte du bas
        </label>
        <input
          id="stamp-bottom-text"
          type="text"
          value={bottomText}
          onChange={(e) => onBottomTextChange(e.target.value)}
          placeholder="AVOCAT AU BARREAU DE PARIS"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="stamp-start-number" style={labelStyle}>
          Num&eacute;ro de d&eacute;part
        </label>
        <input
          id="stamp-start-number"
          type="number"
          value={startNumber}
          min={1}
          onChange={(e) => onStartNumberChange(parseInt(e.target.value) || 1)}
          style={{ ...inputStyle, width: 80 }}
        />
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
        Prochain num&eacute;ro : <strong>{nextNumber}</strong>
      </div>

      {/* Boutons enregistrer / supprimer */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={onSaveStamp}
          disabled={!lawyerName.trim() && !bottomText.trim()}
          style={{
            ...buttonStyle,
            flex: 1,
            background: '#2563eb',
            color: '#fff',
            opacity: !lawyerName.trim() && !bottomText.trim() ? 0.5 : 1
          }}
        >
          {activeStampId ? 'Mettre \u00e0 jour' : 'Enregistrer le tampon'}
        </button>
        {activeStampId && (
          <button
            onClick={() => onDeleteStamp(activeStampId)}
            style={{ ...buttonStyle, background: '#fee2e2', color: '#dc2626' }}
          >
            Supprimer
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: 8,
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #eee'
        }}
      >
        <StampPreview
          lawyerName={lawyerName}
          bottomText={bottomText}
          stampNumber={nextNumber}
          size={180}
        />
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 4,
  color: '#333'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #ccc',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box'
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  border: '1px solid #ccc',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit'
}
