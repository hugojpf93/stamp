import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { PiecesSidebar } from './components/PiecesSidebar'
import { PdfViewer } from './components/PdfViewer'
import { PageNavigator } from './components/PageNavigator'
import { StampConfigurator } from './components/StampConfigurator'
import { StampOverlay } from './components/StampOverlay'
import { Toolbar } from './components/Toolbar'
import { PrintDialog } from './components/PrintDialog'
import type { PieceDocument, StampPlacement, PrintSettings, SavedStamp } from './types'

function nextId(): string {
  return crypto.randomUUID()
}

// Recalcule les numeros de tampon dans l'ordre des pieces
function recalculateNumbers(pieces: PieceDocument[], start: number): PieceDocument[] {
  let num = start
  return pieces.map((piece) => {
    if (piece.placements.length === 0) return piece
    const newPlacements = piece.placements.map((pl) => ({ ...pl, number: num++ }))
    return { ...piece, placements: newPlacements }
  })
}

export default function App() {
  // Configuration du tampon
  const [lawyerName, setLawyerName] = useState('')
  const [bottomText, setBottomText] = useState('AVOCAT')
  const [startNumber, setStartNumber] = useState(1)
  const [nextNumber, setNextNumber] = useState(1)
  const stampRadius = 60

  // Multi-documents
  const [pieces, setPieces] = useState<PieceDocument[]>([])
  const [activePieceId, setActivePieceId] = useState<string | null>(null)

  // Navigation page de la piece active
  const [currentPage, setCurrentPage] = useState(1)

  // Dimensions de la page PDF
  const [pdfPageDims, setPdfPageDims] = useState({ width: 595, height: 842 })
  const [displayDims, setDisplayDims] = useState({ width: 700, height: 990 })

  // Export / Print / Loading
  const [isExporting, setIsExporting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [exportDir, setExportDir] = useState('')

  // Tampons enregistres
  const [savedStamps, setSavedStamps] = useState<SavedStamp[]>([])
  const [activeStampId, setActiveStampId] = useState<string | null>(null)

  // Flag pour eviter de sauvegarder les valeurs vides avant que la config soit chargee
  const configLoadedRef = useRef(false)

  // Charger la configuration persistee au demarrage
  useEffect(() => {
    window.electronAPI.getExportDir().then(setExportDir)
    window.electronAPI.getStampConfig().then((config) => {
      if (config.lawyerName) setLawyerName(config.lawyerName)
      if (config.bottomText) setBottomText(config.bottomText)
      if (config.startNumber && config.startNumber >= 1) {
        setStartNumber(config.startNumber)
        setNextNumber(config.startNumber)
      }
      configLoadedRef.current = true
    })
    window.electronAPI.getSavedStamps().then(setSavedStamps)
  }, [])

  // Sauvegarde automatique de la configuration avec debounce (500ms)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!configLoadedRef.current) return
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      window.electronAPI.saveStampConfig({ lawyerName, bottomText, startNumber })
    }, 500)
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [lawyerName, bottomText, startNumber])

  // Piece active
  const activePiece = useMemo(
    () => pieces.find((p) => p.id === activePieceId) || null,
    [pieces, activePieceId]
  )

  // Total tampons
  const totalStamps = useMemo(
    () => pieces.reduce((sum, p) => sum + p.placements.length, 0),
    [pieces]
  )

  // Ajouter des fichiers
  const handleAddFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    try {
      const results = await window.electronAPI.openFiles()
      if (!results || results.length === 0) return

      const newPieces: PieceDocument[] = results.map((r) => {
        const buf = new Uint8Array(r.buffer.length)
        buf.set(r.buffer)
        return {
          id: nextId(),
          fileName: r.name,
          pdfBuffer: buf,
          totalPages: 0,
          placements: []
        }
      })

      setPieces((prev) => [...prev, ...newPieces])

      // Selectionner la premiere nouvelle piece si aucune n'est active
      if (!activePieceId) {
        setActivePieceId(newPieces[0].id)
        setCurrentPage(1)
      }
    } catch (err: unknown) {
      console.error('Erreur chargement fichiers:', err)
      const message =
        err instanceof Error ? err.message : 'Erreur lors du chargement des fichiers.'
      alert(message)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [activePieceId])

  // Selectionner une piece
  const handleSelectPiece = useCallback((id: string) => {
    setActivePieceId(id)
    setCurrentPage(1)
  }, [])

  // Reordonner les pieces (les numeros de tampon suivent le nouvel ordre)
  const handleReorderPiece = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setPieces((prev) => {
        const idx = prev.findIndex((p) => p.id === id)
        if (idx === -1) return prev
        const newIdx = direction === 'up' ? idx - 1 : idx + 1
        if (newIdx < 0 || newIdx >= prev.length) return prev
        const copy = [...prev]
        ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
        // Recalculer les numeros de tampon selon le nouvel ordre
        const renumbered = recalculateNumbers(copy, startNumber)
        const total = renumbered.reduce((sum, p) => sum + p.placements.length, 0)
        setNextNumber(startNumber + total)
        return renumbered
      })
    },
    [startNumber]
  )

  // Mettre a jour totalPages d'une piece
  const handleTotalPages = useCallback(
    (total: number) => {
      if (!activePieceId) return
      setPieces((prev) =>
        prev.map((p) => (p.id === activePieceId ? { ...p, totalPages: total } : p))
      )
    },
    [activePieceId]
  )

  // Dimensions de la page
  const handlePageDimensions = useCallback(
    (pdfW: number, pdfH: number, dispW: number, dispH: number) => {
      setPdfPageDims({ width: pdfW, height: pdfH })
      setDisplayDims({ width: dispW, height: dispH })
    },
    []
  )

  // Placer ou deplacer un tampon sur la piece active (1 seul tampon par piece, page 1 uniquement)
  const handlePlaceStamp = useCallback(
    (pageIndex: number, x: number, y: number) => {
      if (!activePieceId) return
      // Tampon uniquement sur la première page (pageIndex === 0)
      if (pageIndex !== 0) return

      setPieces((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== activePieceId) return p

          const existing = p.placements.find((pl) => pl.pageIndex === pageIndex)
          if (existing) {
            // Deplacer le tampon existant (garder le meme numero)
            return {
              ...p,
              placements: p.placements.map((pl) =>
                pl.pageIndex === pageIndex ? { ...pl, x, y } : pl
              )
            }
          } else if (p.placements.length === 0) {
            // Nouveau tampon — le numero sera recalcule par recalculateNumbers
            const placement: StampPlacement = {
              pageIndex,
              x,
              y,
              number: 0 // placeholder, sera recalcule
            }
            return { ...p, placements: [...p.placements, placement] }
          }
          // La piece a deja un tampon sur une autre page → ne rien faire
          return p
        })

        // Recalculer tous les numeros sequentiellement
        const renumbered = recalculateNumbers(updated, startNumber)
        const total = renumbered.reduce((sum, p) => sum + p.placements.length, 0)
        setNextNumber(startNumber + total)
        return renumbered
      })
    },
    [activePieceId, startNumber]
  )

  // Annuler le dernier tampon de la piece active
  const handleUndo = useCallback(() => {
    if (!activePieceId) return
    setPieces((prev) => {
      const updated = prev.map((p) =>
        p.id === activePieceId ? { ...p, placements: p.placements.slice(0, -1) } : p
      )
      const renumbered = recalculateNumbers(updated, startNumber)
      const totalStamps = renumbered.reduce((sum, p) => sum + p.placements.length, 0)
      setNextNumber(startNumber + totalStamps)
      return renumbered
    })
  }, [activePieceId, startNumber])

  // Effacer les tampons de la piece active
  const handleClearStamps = useCallback(() => {
    if (!activePieceId) return
    setPieces((prev) => {
      const updated = prev.map((p) => (p.id === activePieceId ? { ...p, placements: [] } : p))
      const renumbered = recalculateNumbers(updated, startNumber)
      const totalStamps = renumbered.reduce((sum, p) => sum + p.placements.length, 0)
      setNextNumber(startNumber + totalStamps)
      return renumbered
    })
  }, [activePieceId, startNumber])

  // Navigation
  const handleNextPage = useCallback(() => {
    if (!activePiece) return
    setCurrentPage((p) => Math.min(p + 1, activePiece.totalPages))
  }, [activePiece])

  const handlePrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1))
  }, [])

  const handleGoToPage = useCallback(
    (page: number) => {
      if (!activePiece) return
      setCurrentPage(Math.max(1, Math.min(page, activePiece.totalPages)))
    },
    [activePiece]
  )

  // Choisir le dossier d'export
  const handleSelectExportDir = useCallback(async () => {
    const dir = await window.electronAPI.selectExportDir()
    setExportDir(dir)
  }, [])

  // Exporter toutes les pieces
  const handleExportAll = useCallback(async () => {
    if (pieces.length === 0) return

    setIsExporting(true)
    try {
      const exportPieces = pieces.map((p, index) => ({
        buffer: p.pdfBuffer,
        placements: p.placements,
        pieceNumber: startNumber + index,
        fileName: p.fileName
      }))

      const config = { lawyerName, bottomText, radius: stampRadius }
      const outputFolder = await window.electronAPI.exportAll(exportPieces, config, exportDir)

      if (outputFolder) {
        alert(`Export termin\u00e9 avec succ\u00e8s !\n\nDossier : ${outputFolder}`)
      }
    } catch (err: unknown) {
      console.error("Erreur lors de l'export:", err)
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'export. Veuillez r\u00e9essayer."
      alert(message)
    } finally {
      setIsExporting(false)
    }
  }, [pieces, lawyerName, bottomText, exportDir, startNumber])

  // Imprimer toutes les pieces (chaque piece = un job separe)
  const handlePrintAll = useCallback(
    async (settings: PrintSettings) => {
      if (pieces.length === 0) return
      setShowPrintDialog(false)
      setIsPrinting(true)
      try {
        const printPieces = pieces.map((p) => ({
          buffer: p.pdfBuffer,
          placements: p.placements,
          fileName: p.fileName
        }))
        const config = { lawyerName, bottomText, radius: stampRadius }
        const results = await window.electronAPI.printAll(printPieces, config, settings)

        const failed = results.filter((r) => !r.success)
        if (failed.length === 0) {
          alert(`Impression lanc\u00e9e pour ${results.length} pi\u00e8ce(s) !`)
        } else {
          alert(
            `${results.length - failed.length}/${results.length} pi\u00e8ce(s) imprim\u00e9e(s).\n` +
              `\u00c9chec : ${failed.map((f) => f.fileName).join(', ')}`
          )
        }
      } catch (err: unknown) {
        console.error("Erreur lors de l'impression:", err)
        const message =
          err instanceof Error
            ? err.message
            : "Erreur lors de l'impression. Veuillez r\u00e9essayer."
        alert(message)
      } finally {
        setIsPrinting(false)
      }
    },
    [pieces, lawyerName, bottomText]
  )

  // Fusionner deux pieces adjacentes
  const handleMergePieces = useCallback(
    async (topId: string, bottomId: string) => {
      const topPiece = pieces.find((p) => p.id === topId)
      const bottomPiece = pieces.find((p) => p.id === bottomId)
      if (!topPiece || !bottomPiece) return

      try {
        // Fusionner les PDF via IPC
        const mergedBuffer = await window.electronAPI.mergePdfs(
          topPiece.pdfBuffer,
          bottomPiece.pdfBuffer
        )

        // Combiner les placements (ajuster les pageIndex de la 2ème pièce)
        const topPages = topPiece.totalPages
        const adjustedPlacements = bottomPiece.placements.map((pl) => ({
          ...pl,
          pageIndex: pl.pageIndex + topPages
        }))
        const mergedPlacements = [...topPiece.placements, ...adjustedPlacements]

        // Créer la pièce fusionnée
        const mergedPiece: PieceDocument = {
          id: topPiece.id,
          fileName: topPiece.fileName,
          pdfBuffer: new Uint8Array(mergedBuffer),
          totalPages: topPiece.totalPages + bottomPiece.totalPages,
          placements: mergedPlacements
        }

        // Remplacer les deux pièces par la pièce fusionnée
        setPieces((prev) => {
          const topIndex = prev.findIndex((p) => p.id === topId)
          const newPieces = prev.filter((p) => p.id !== topId && p.id !== bottomId)
          newPieces.splice(topIndex, 0, mergedPiece)

          const renumbered = recalculateNumbers(newPieces, startNumber)
          const total = renumbered.reduce((sum, p) => sum + p.placements.length, 0)
          setNextNumber(startNumber + total)
          return renumbered
        })

        // Si la pièce active était l'une des deux, sélectionner la fusionnée
        if (activePieceId === topId || activePieceId === bottomId) {
          setActivePieceId(mergedPiece.id)
          setCurrentPage(1)
        }
      } catch (err: unknown) {
        console.error('Erreur fusion:', err)
        const message =
          err instanceof Error ? err.message : 'Erreur lors de la fusion des pi\u00e8ces.'
        alert(message)
      }
    },
    [pieces, activePieceId, startNumber]
  )

  // Scinder une piece en deux apres une page donnee
  const handleSplitPiece = useCallback(
    async (pieceId: string, afterPageIndex: number) => {
      const piece = pieces.find((p) => p.id === pieceId)
      if (!piece) return

      try {
        const { part1, part2 } = await window.electronAPI.splitPdf(piece.pdfBuffer, afterPageIndex)

        // Placements pour part1 : ceux sur les pages 0..afterPageIndex
        const placements1 = piece.placements.filter((pl) => pl.pageIndex <= afterPageIndex)

        // Placements pour part2 : ceux sur les pages > afterPageIndex, avec pageIndex recalcule
        const placements2 = piece.placements
          .filter((pl) => pl.pageIndex > afterPageIndex)
          .map((pl) => ({ ...pl, pageIndex: pl.pageIndex - afterPageIndex - 1 }))

        const piece1: PieceDocument = {
          id: pieceId,
          fileName: piece.fileName,
          pdfBuffer: new Uint8Array(part1),
          totalPages: afterPageIndex + 1,
          placements: placements1
        }

        const piece2: PieceDocument = {
          id: nextId(),
          fileName: piece.fileName + ' (suite)',
          pdfBuffer: new Uint8Array(part2),
          totalPages: (piece.totalPages || 0) - afterPageIndex - 1,
          placements: placements2
        }

        setPieces((prev) => {
          const idx = prev.findIndex((p) => p.id === pieceId)
          const newPieces = [...prev]
          newPieces.splice(idx, 1, piece1, piece2)

          const renumbered = recalculateNumbers(newPieces, startNumber)
          const total = renumbered.reduce((sum, p) => sum + p.placements.length, 0)
          setNextNumber(startNumber + total)
          return renumbered
        })

        // Garder la piece 1 active
        if (activePieceId === pieceId) {
          setActivePieceId(piece1.id)
          setCurrentPage(1)
        }
      } catch (err: unknown) {
        console.error('Erreur scission:', err)
        const message =
          err instanceof Error ? err.message : 'Erreur lors de la scission de la pi\u00e8ce.'
        alert(message)
      }
    },
    [pieces, activePieceId, startNumber]
  )

  // Renommer une piece
  const handleRenamePiece = useCallback((id: string, newName: string) => {
    setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, displayName: newName } : p)))
  }, [])

  // Changer le numero de depart
  const handleStartNumberChange = useCallback((num: number) => {
    setStartNumber(num)
    setNextNumber(num)
  }, [])

  // Selectionner un tampon enregistre
  const handleSelectStamp = useCallback(
    (id: string | null) => {
      setActiveStampId(id)
      if (!id) return
      const stamp = savedStamps.find((s) => s.id === id)
      if (stamp) {
        setLawyerName(stamp.lawyerName)
        setBottomText(stamp.bottomText)
      }
    },
    [savedStamps]
  )

  // Enregistrer le tampon actuel
  const handleSaveStamp = useCallback(async () => {
    const name = lawyerName.trim() || bottomText.trim() || 'Tampon'
    const stamp: SavedStamp = {
      id: activeStampId || crypto.randomUUID(),
      name,
      lawyerName,
      bottomText
    }
    await window.electronAPI.saveStamp(stamp)
    const updated = await window.electronAPI.getSavedStamps()
    setSavedStamps(updated)
    setActiveStampId(stamp.id)
  }, [activeStampId, lawyerName, bottomText])

  // Supprimer un tampon enregistre
  const handleDeleteStamp = useCallback(async (id: string) => {
    await window.electronAPI.deleteStamp(id)
    const updated = await window.electronAPI.getSavedStamps()
    setSavedStamps(updated)
    setActiveStampId(null)
  }, [])

  // Retirer une piece
  const handleRemovePiece = useCallback(
    (id: string) => {
      setPieces((prev) => {
        const newList = prev.filter((p) => p.id !== id)
        if (activePieceId === id) {
          if (newList.length > 0) {
            setActivePieceId(newList[0].id)
            setCurrentPage(1)
          } else {
            setActivePieceId(null)
          }
        }
        // Recalculer les numeros apres suppression
        const renumbered = recalculateNumbers(newList, startNumber)
        const totalStamps = renumbered.reduce((sum, p) => sum + p.placements.length, 0)
        setNextNumber(startNumber + totalStamps)
        return renumbered
      })
    },
    [activePieceId, startNumber]
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <Toolbar
        hasPieces={pieces.length > 0}
        hasStamps={activePiece ? activePiece.placements.length > 0 : false}
        onAddFiles={handleAddFiles}
        onExportAll={handleExportAll}
        onPrintAll={() => setShowPrintDialog(true)}
        onUndo={handleUndo}
        onClearStamps={handleClearStamps}
        isExporting={isExporting}
        isPrinting={isPrinting}
        totalPieces={pieces.length}
        totalStamps={totalStamps}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Volet gauche : liste des pieces */}
        <aside aria-label="Liste des pièces" style={{ display: 'flex', minHeight: 0 }}>
          <PiecesSidebar
            pieces={pieces}
            activePieceId={activePieceId}
            onSelectPiece={handleSelectPiece}
            onRemovePiece={handleRemovePiece}
            onReorderPiece={handleReorderPiece}
            onMergePieces={handleMergePieces}
            onSplitPiece={handleSplitPiece}
            onRenamePiece={handleRenamePiece}
          />
        </aside>

        {/* Zone centrale : visualisation du PDF */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'auto',
            background: '#e8e8e8',
            padding: 16
          }}
        >
          {!activePiece ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#888'
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#128196;</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>
                Cliquez sur &laquo; Ajouter des pi&egrave;ces &raquo; pour commencer
              </p>
              <p style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
                Vous pouvez s&eacute;lectionner plusieurs fichiers &agrave; la fois
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600, color: '#333' }}>
                Pi&egrave;ce n&deg;{pieces.findIndex((p) => p.id === activePieceId) + 1} &mdash;{' '}
                {activePiece.displayName || activePiece.fileName}
              </div>

              <PageNavigator
                currentPage={currentPage}
                totalPages={activePiece.totalPages}
                onPrevPage={handlePrevPage}
                onNextPage={handleNextPage}
                onGoToPage={handleGoToPage}
              />

              <PdfViewer
                pdfBuffer={activePiece.pdfBuffer}
                currentPage={currentPage}
                onTotalPages={handleTotalPages}
                onPageDimensions={handlePageDimensions}
              >
                <StampOverlay
                  pdfPageWidth={pdfPageDims.width}
                  pdfPageHeight={pdfPageDims.height}
                  displayWidth={displayDims.width}
                  displayHeight={displayDims.height}
                  currentPage={currentPage}
                  nextNumber={nextNumber}
                  lawyerName={lawyerName}
                  bottomText={bottomText}
                  stampRadius={stampRadius}
                  placements={activePiece.placements}
                  onPlace={handlePlaceStamp}
                />
              </PdfViewer>

              <div style={{ padding: 8, fontSize: 12, color: '#666' }}>
                {activePiece.placements.length} tampon(s) sur cette pi&egrave;ce &mdash; Cliquez sur
                le document pour placer le tampon
              </div>
            </>
          )}
        </main>

        {/* Volet droit : configuration du tampon */}
        <aside
          aria-label="Configuration du tampon"
          style={{
            width: 280,
            borderLeft: '1px solid #ddd',
            background: '#fff',
            overflowY: 'auto'
          }}
        >
          <StampConfigurator
            lawyerName={lawyerName}
            bottomText={bottomText}
            startNumber={startNumber}
            nextNumber={nextNumber}
            savedStamps={savedStamps}
            activeStampId={activeStampId}
            onLawyerNameChange={setLawyerName}
            onBottomTextChange={setBottomText}
            onStartNumberChange={handleStartNumberChange}
            onSelectStamp={handleSelectStamp}
            onSaveStamp={handleSaveStamp}
            onDeleteStamp={handleDeleteStamp}
          />

          {/* Configuration du dossier d'export */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #eee' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>
              Dossier d&apos;export
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#666',
                wordBreak: 'break-all',
                background: '#f5f5f5',
                padding: '6px 8px',
                borderRadius: 4,
                marginBottom: 8,
                border: '1px solid #e0e0e0'
              }}
              title={exportDir}
            >
              {exportDir || 'Non d\u00e9fini'}
            </div>
            <button
              onClick={handleSelectExportDir}
              style={{
                width: '100%',
                padding: '6px 12px',
                fontSize: 12,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
                color: '#333'
              }}
            >
              Changer le dossier
            </button>
            <div style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
              Un sous-dossier DOSSIER_PIECES_JJMMAAAA sera cr&eacute;&eacute; automatiquement.
            </div>
          </div>
        </aside>
      </div>

      {showPrintDialog && (
        <PrintDialog
          onPrint={handlePrintAll}
          onCancel={() => setShowPrintDialog(false)}
          totalPieces={pieces.length}
        />
      )}

      {isLoadingFiles && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '32px 48px',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: '4px solid #e0e0e0',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px'
              }}
            />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
              Chargement des fichiers...
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
              La conversion DOCX peut prendre quelques secondes
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}
