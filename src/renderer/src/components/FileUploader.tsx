import { useCallback, DragEvent, useRef } from 'react'

interface FileUploaderProps {
  onFileLoaded: (buffer: Uint8Array, fileName: string) => void
}

export function FileUploader({ onFileLoaded }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleOpenFile = useCallback(async () => {
    const result = await window.electronAPI.openFile()
    if (result) {
      onFileLoaded(new Uint8Array(result.buffer), result.name)
    }
  }, [onFileLoaded])

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const file = e.dataTransfer.files[0]
      if (!file) return

      const ext = file.name.toLowerCase().split('.').pop()

      if (
        ext === 'pdf' ||
        ext === 'jpg' ||
        ext === 'jpeg' ||
        ext === 'png' ||
        ext === 'tiff' ||
        ext === 'webp'
      ) {
        // Pour les images, on envoie via l'API Electron qui fait la conversion
        // Pour les PDF, on envoie directement
        const result = await window.electronAPI.openFile()
        if (result) {
          onFileLoaded(new Uint8Array(result.buffer), result.name)
        }
      }
    },
    [onFileLoaded]
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 24
      }}
    >
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleOpenFile}
        style={{
          border: '2px dashed #888',
          borderRadius: 12,
          padding: '60px 80px',
          textAlign: 'center',
          cursor: 'pointer',
          color: '#666',
          transition: 'border-color 0.2s',
          maxWidth: 500
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#333')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#888')}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#128196;</div>
        <p style={{ fontSize: 18, margin: '0 0 8px 0', fontWeight: 600 }}>
          Cliquez ici ou glissez un fichier
        </p>
        <p style={{ fontSize: 14, margin: 0, color: '#999' }}>
          Formats accept&eacute;s : PDF, JPEG, PNG, TIFF, WebP
        </p>
      </div>
      <input ref={inputRef} type="file" style={{ display: 'none' }} />
    </div>
  )
}
