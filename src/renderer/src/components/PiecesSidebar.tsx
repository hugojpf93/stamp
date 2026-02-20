import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PieceDocument } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

interface PiecesSidebarProps {
  pieces: PieceDocument[]
  activePieceId: string | null
  onSelectPiece: (id: string) => void
  onRemovePiece: (id: string) => void
  onReorderPiece: (id: string, direction: 'up' | 'down') => void
  onMergePieces?: (topId: string, bottomId: string) => void
  onSplitPiece?: (pieceId: string, afterPageIndex: number) => void
  onRenamePiece?: (id: string, newName: string) => void
}

export function PiecesSidebar({
  pieces,
  activePieceId,
  onSelectPiece,
  onRemovePiece,
  onReorderPiece,
  onMergePieces,
  onSplitPiece,
  onRenamePiece
}: PiecesSidebarProps) {
  return (
    <div
      role="listbox"
      aria-label="Liste des pièces"
      style={{
        width: 220,
        borderRight: '1px solid #ddd',
        background: '#f5f5f5',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #ddd',
          fontWeight: 600,
          fontSize: 13,
          background: '#eee'
        }}
      >
        Pi&egrave;ces ({pieces.length})
      </div>

      {pieces.length === 0 && (
        <div style={{ padding: 16, color: '#999', fontSize: 13, textAlign: 'center' }}>
          Aucune pi&egrave;ce charg&eacute;e
        </div>
      )}

      {pieces.map((piece, index) => (
        <React.Fragment key={piece.id}>
          <PieceThumbnail
            piece={piece}
            pieceNumber={index + 1}
            isActive={piece.id === activePieceId}
            onSelect={() => onSelectPiece(piece.id)}
            onRemove={() => onRemovePiece(piece.id)}
            canMoveUp={index > 0}
            canMoveDown={index < pieces.length - 1}
            onMoveUp={() => onReorderPiece(piece.id, 'up')}
            onMoveDown={() => onReorderPiece(piece.id, 'down')}
            onSplitAfterPage={
              onSplitPiece
                ? (afterPageIndex: number) => onSplitPiece(piece.id, afterPageIndex)
                : undefined
            }
            onRename={
              onRenamePiece ? (newName: string) => onRenamePiece(piece.id, newName) : undefined
            }
          />
          {index < pieces.length - 1 && onMergePieces && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
              <button
                onClick={() => onMergePieces(piece.id, pieces[index + 1].id)}
                style={mergeBtnStyle}
                title="Fusionner ces deux pièces"
                aria-label="Fusionner les pièces adjacentes"
              >
                &#128279;
              </button>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function PieceThumbnail({
  piece,
  pieceNumber,
  isActive,
  onSelect,
  onRemove,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onSplitAfterPage,
  onRename
}: {
  piece: PieceDocument
  pieceNumber: number
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onSplitAfterPage?: (afterPageIndex: number) => void
  onRename?: (newName: string) => void
}) {
  const fileData = useMemo(() => {
    const copy = new Uint8Array(piece.pdfBuffer)
    return { data: copy }
  }, [piece.pdfBuffer])

  const stampCount = piece.placements.length

  // Nombre de pages détecté localement via react-pdf onLoadSuccess
  const [numPages, setNumPages] = useState(0)

  // État pour déplier/replier les pages
  const [expanded, setExpanded] = useState(false)

  // État pour l'édition du nom
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
  }, [])

  const displayName = piece.displayName || piece.fileName

  const handleStartEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditValue(displayName)
      setIsEditing(true)
    },
    [displayName]
  )

  const handleConfirmEdit = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== displayName && onRename) {
      onRename(trimmed)
    }
    setIsEditing(false)
  }, [editValue, displayName, onRename])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirmEdit()
      } else if (e.key === 'Escape') {
        setIsEditing(false)
      }
    },
    [handleConfirmEdit]
  )

  // Focus l'input quand on passe en mode édition
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const totalPages = numPages || piece.totalPages
  const hasMultiplePages = totalPages > 1
  const pagesToShow = expanded ? totalPages : 1

  return (
    <div
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        padding: '8px 10px',
        borderBottom: '1px solid #e0e0e0',
        cursor: 'pointer',
        background: isActive ? '#d4e4ff' : 'transparent',
        borderLeft: isActive ? '3px solid #2563eb' : '3px solid transparent',
        transition: 'background 0.15s'
      }}
    >
      {/* Info */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#333', marginBottom: 2 }}>
        Pi&egrave;ce n&deg;{pieceNumber}
      </div>

      {/* Nom de la pièce - éditable */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleConfirmEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            color: '#333',
            width: '100%',
            border: '1px solid #2563eb',
            borderRadius: 3,
            padding: '1px 4px',
            marginBottom: 4,
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      ) : (
        <div
          style={{
            fontSize: 11,
            color: '#666',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 4,
            cursor: onRename ? 'text' : 'pointer',
            borderBottom: onRename ? '1px dashed transparent' : 'none'
          }}
          title={`${displayName} (double-cliquer pour renommer)`}
          onDoubleClick={onRename ? handleStartEdit : undefined}
        >
          {displayName}
        </div>
      )}

      <div
        style={{
          fontSize: 10,
          color: '#999',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        <span>
          {totalPages} page(s) &middot; {stampCount} tampon(s)
        </span>
        {hasMultiplePages && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            aria-expanded={expanded}
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 9,
              color: '#666',
              padding: '0 4px',
              lineHeight: '16px'
            }}
            title={expanded ? 'Replier les pages' : 'Voir toutes les pages'}
          >
            {expanded ? '▲ Replier' : '▼ Déplier'}
          </button>
        )}
      </div>

      {/* Miniatures des pages */}
      <Document
        file={fileData}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div style={{ height: 80 }} />}
        error={<div style={{ height: 80, background: '#fee' }} />}
      >
        {Array.from({ length: numPages }, (_, i) => i)
          .filter((i) => i < pagesToShow)
          .map((i) => (
            <React.Fragment key={i}>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 2,
                  pointerEvents: 'none',
                  position: 'relative'
                }}
              >
                <Page
                  pageNumber={i + 1}
                  width={180}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
                {/* Numéro de page */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 4,
                    fontSize: 9,
                    color: '#999',
                    background: 'rgba(255,255,255,0.8)',
                    padding: '0 3px',
                    borderRadius: 2
                  }}
                >
                  p.{i + 1}
                </div>
              </div>
              {/* Bouton ciseaux entre les pages (sauf après la dernière) */}
              {expanded && i < numPages - 1 && onSplitAfterPage && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '1px 0',
                    pointerEvents: 'auto'
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSplitAfterPage(i)
                    }}
                    style={splitBtnStyle}
                    title={`Scinder après la page ${i + 1}`}
                    aria-label={`Scinder après la page ${i + 1}`}
                  >
                    &#9986;
                  </button>
                </div>
              )}
            </React.Fragment>
          ))}
      </Document>

      {/* Indicateur pages cachées quand replié */}
      {!expanded && hasMultiplePages && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(true)
          }}
          style={{
            fontSize: 10,
            color: '#888',
            textAlign: 'center',
            padding: '3px 0',
            cursor: 'pointer',
            borderTop: '1px dashed #ddd',
            marginTop: 2
          }}
        >
          + {totalPages - 1} autre(s) page(s)
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          disabled={!canMoveUp}
          style={miniBtn}
          title="Monter"
          aria-label="Monter la pièce"
        >
          &#9650;
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          disabled={!canMoveDown}
          style={miniBtn}
          title="Descendre"
          aria-label="Descendre la pièce"
        >
          &#9660;
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{ ...miniBtn, color: '#c00' }}
          title="Retirer cette pièce"
          aria-label="Retirer la pièce"
        >
          &#10005;
        </button>
      </div>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  padding: '2px 6px',
  border: '1px solid #ccc',
  borderRadius: 3,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 10,
  lineHeight: 1
}

const mergeBtnStyle: React.CSSProperties = {
  padding: '1px 10px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#f0f0f0',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: '18px',
  color: '#666',
  transition: 'all 0.15s'
}

const splitBtnStyle: React.CSSProperties = {
  padding: '0 8px',
  border: '1px dashed #bbb',
  borderRadius: 3,
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: '16px',
  color: '#888',
  transition: 'all 0.15s'
}
