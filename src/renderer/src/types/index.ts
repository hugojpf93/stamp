export interface StampConfig {
  lawyerName: string
  bottomText: string
  radius: number
}

export interface StampPlacement {
  pageIndex: number
  x: number
  y: number
  number: number
}

export interface PieceDocument {
  id: string
  fileName: string
  displayName?: string
  pdfBuffer: Uint8Array
  totalPages: number
  placements: StampPlacement[]
}

export interface PrintSettings {
  deviceName: string
  copies: number
  side?: 'duplex' | 'duplexshort' | 'duplexlong' | 'simplex'
}

export interface SavedStamp {
  id: string
  name: string
  lawyerName: string
  bottomText: string
}

export interface PrinterInfo {
  name: string
  displayName: string
  description: string
  isDefault: boolean
}

export interface ElectronAPI {
  openFiles: () => Promise<Array<{ buffer: Uint8Array; name: string }> | null>
  getExportDir: () => Promise<string>
  selectExportDir: () => Promise<string>
  exportAll: (
    pieces: Array<{
      buffer: Uint8Array
      placements: StampPlacement[]
      pieceNumber: number
      fileName: string
    }>,
    config: StampConfig,
    baseDir?: string
  ) => Promise<string>
  applyStamps: (
    pdfBuffer: Uint8Array,
    placements: StampPlacement[],
    config: StampConfig
  ) => Promise<Uint8Array>
  getPrinters: () => Promise<PrinterInfo[]>
  printAll: (
    pieces: Array<{
      buffer: Uint8Array
      placements: StampPlacement[]
      fileName: string
    }>,
    config: StampConfig,
    printSettings: PrintSettings
  ) => Promise<Array<{ fileName: string; success: boolean }>>
  mergePdfs: (buffer1: Uint8Array, buffer2: Uint8Array) => Promise<Uint8Array>
  splitPdf: (
    buffer: Uint8Array,
    afterPageIndex: number
  ) => Promise<{ part1: Uint8Array; part2: Uint8Array }>
  getStampConfig: () => Promise<{ lawyerName: string; bottomText: string; startNumber: number }>
  saveStampConfig: (config: {
    lawyerName: string
    bottomText: string
    startNumber: number
  }) => Promise<void>
  getSavedStamps: () => Promise<SavedStamp[]>
  saveStamp: (stamp: SavedStamp) => Promise<void>
  deleteStamp: (id: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
