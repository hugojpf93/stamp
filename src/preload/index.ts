import { contextBridge, ipcRenderer } from 'electron'

// Types IPC partagés (miroir de src/renderer/src/types/index.ts)
interface StampPlacement {
  pageIndex: number
  x: number
  y: number
  number: number
}

interface StampConfig {
  lawyerName: string
  bottomText: string
  radius: number
}

interface PrintSettings {
  deviceName: string
  copies: number
  side?: 'duplex' | 'duplexshort' | 'duplexlong' | 'simplex'
}

interface ExportPiece {
  buffer: Uint8Array
  placements: StampPlacement[]
  pieceNumber: number
  fileName: string
}

interface PrintPiece {
  buffer: Uint8Array
  placements: StampPlacement[]
  fileName: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  openFiles: () => ipcRenderer.invoke('open-files'),
  getExportDir: () => ipcRenderer.invoke('get-export-dir'),
  selectExportDir: () => ipcRenderer.invoke('select-export-dir'),
  exportAll: (pieces: ExportPiece[], config: StampConfig, baseDir?: string) => {
    // Convertir les Uint8Array en Buffer pour un transfert IPC fiable
    const serializedPieces = pieces.map((p) => ({
      ...p,
      buffer: Buffer.from(p.buffer)
    }))
    return ipcRenderer.invoke('export-all', serializedPieces, config, baseDir)
  },
  applyStamps: (pdfBuffer: Uint8Array, placements: StampPlacement[], config: StampConfig) =>
    ipcRenderer.invoke('apply-stamps', Buffer.from(pdfBuffer), placements, config),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printAll: (pieces: PrintPiece[], config: StampConfig, printSettings: PrintSettings) => {
    const serializedPieces = pieces.map((p) => ({
      ...p,
      buffer: Buffer.from(p.buffer)
    }))
    return ipcRenderer.invoke('print-all', serializedPieces, config, printSettings)
  },
  mergePdfs: (buffer1: Uint8Array, buffer2: Uint8Array) =>
    ipcRenderer.invoke('merge-pdfs', Buffer.from(buffer1), Buffer.from(buffer2)),
  splitPdf: (buffer: Uint8Array, afterPageIndex: number) =>
    ipcRenderer.invoke('split-pdf', Buffer.from(buffer), afterPageIndex),
  getStampConfig: (): Promise<{ lawyerName: string; bottomText: string; startNumber: number }> =>
    ipcRenderer.invoke('get-stamp-config'),
  saveStampConfig: (config: {
    lawyerName: string
    bottomText: string
    startNumber: number
  }): Promise<void> => ipcRenderer.invoke('save-stamp-config', config),
  getSavedStamps: (): Promise<
    Array<{ id: string; name: string; lawyerName: string; bottomText: string }>
  > => ipcRenderer.invoke('get-saved-stamps'),
  saveStamp: (stamp: {
    id: string
    name: string
    lawyerName: string
    bottomText: string
  }): Promise<void> => ipcRenderer.invoke('save-stamp', stamp),
  deleteStamp: (id: string): Promise<void> => ipcRenderer.invoke('delete-stamp', id)
})
