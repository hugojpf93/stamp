import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, writeFile, unlink, mkdir, rename, rm } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { is } from '@electron-toolkit/utils'
import {
  convertImageToPdf,
  convertDocxToPdf,
  applyStamps,
  mergePdfs,
  splitPdf
} from './pdf-service'
import { toUint8Array, validateExportPath, sanitizeFileName, translateFsError } from './helpers'
import { initAutoUpdater } from './updater'
import { getConfig, setConfig, getSavedStamps, saveStamp, deleteStamp } from './config-store'

// Chemin d'export par défaut (lu depuis le store persistant)
let defaultExportDir = getConfig().exportDir
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfToPrinter = require('pdf-to-printer')

// Registre des fichiers temporaires pour nettoyage au quit
const pendingTempFiles = new Set<string>()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 850,
    minWidth: 1000,
    minHeight: 600,
    title: 'STAMP - Tampon Avocat',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    // Retry si le serveur Vite n'est pas encore pret
    const loadWithRetry = (retries: number): void => {
      mainWindow.loadURL(url).catch(() => {
        if (retries > 0) {
          setTimeout(() => loadWithRetry(retries - 1), 1000)
        }
      })
    }
    loadWithRetry(10)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // IPC: Ouvrir un ou plusieurs fichiers (PDF ou image)
  ipcMain.handle('open-files', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Ouvrir des pièces',
      filters: [
        {
          name: 'Documents',
          extensions: ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'webp', 'docx', 'doc']
        },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word', extensions: ['docx', 'doc'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'tiff', 'webp'] }
      ],
      properties: ['openFile', 'multiSelections']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const files: Array<{ buffer: Buffer; name: string }> = []
    const errors: string[] = []

    for (const filePath of result.filePaths) {
      const fileName = filePath.split(/[\\/]/).pop() || 'document'
      try {
        const fileBuffer = await readFile(filePath)
        const ext = filePath.toLowerCase().split('.').pop()

        let pdfBuffer: Buffer
        if (ext === 'pdf') {
          pdfBuffer = fileBuffer
        } else if (ext === 'docx' || ext === 'doc') {
          const pdfBytes = await convertDocxToPdf(filePath)
          pdfBuffer = Buffer.from(pdfBytes)
        } else {
          const converted = await convertImageToPdf(fileBuffer)
          pdfBuffer = Buffer.from(converted)
        }

        files.push({ buffer: pdfBuffer, name: fileName })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`Erreur conversion fichier ${fileName}:`, message)
        errors.push(fileName)
      }
    }

    if (files.length === 0 && errors.length > 0) {
      throw new Error(`Impossible d'ouvrir les fichiers suivants :\n${errors.join('\n')}`)
    }

    return files.length > 0 ? files : null
  })

  // IPC: Obtenir le chemin d'export par défaut
  ipcMain.handle('get-export-dir', () => {
    return defaultExportDir
  })

  // IPC: Choisir un nouveau chemin d'export par défaut
  ipcMain.handle('select-export-dir', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choisir le dossier d\u2019export par défaut',
      defaultPath: defaultExportDir,
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return defaultExportDir
    }
    defaultExportDir = result.filePaths[0]
    setConfig({ exportDir: defaultExportDir })
    return defaultExportDir
  })

  // IPC: Lire la configuration du tampon persistee
  ipcMain.handle('get-stamp-config', () => {
    const config = getConfig()
    return {
      lawyerName: config.lawyerName,
      bottomText: config.bottomText,
      startNumber: config.startNumber
    }
  })

  // IPC: Sauvegarder la configuration du tampon
  ipcMain.handle(
    'save-stamp-config',
    (_event, config: { lawyerName: string; bottomText: string; startNumber: number }) => {
      const lawyerName =
        typeof config.lawyerName === 'string' ? config.lawyerName.slice(0, 200) : ''
      const bottomText = typeof config.bottomText === 'string' ? config.bottomText.slice(0, 200) : 'AVOCAT'
      const raw = typeof config.startNumber === 'number' ? config.startNumber : 1
      const startNumber = Math.max(1, Math.min(99999, Math.floor(raw)))
      setConfig({ lawyerName, bottomText, startNumber })
    }
  )

  // IPC: Lister les tampons enregistres
  ipcMain.handle('get-saved-stamps', () => {
    return getSavedStamps()
  })

  // IPC: Enregistrer un tampon
  ipcMain.handle(
    'save-stamp',
    (
      _event,
      stamp: { id: string; name: string; lawyerName: string; bottomText: string }
    ) => {
      const validated = {
        id: typeof stamp.id === 'string' ? stamp.id : '',
        name: typeof stamp.name === 'string' ? stamp.name.slice(0, 100) : '',
        lawyerName: typeof stamp.lawyerName === 'string' ? stamp.lawyerName.slice(0, 200) : '',
        bottomText: typeof stamp.bottomText === 'string' ? stamp.bottomText.slice(0, 200) : 'AVOCAT'
      }
      if (!validated.id || !validated.name) return
      saveStamp(validated)
    }
  )

  // IPC: Supprimer un tampon enregistre
  ipcMain.handle('delete-stamp', (_event, id: string) => {
    if (typeof id === 'string' && id) {
      deleteStamp(id)
    }
  })

  // IPC: Exporter toutes les pieces tamponnees dans un sous-dossier DOSSIER_PIECES_DDMMYYYY
  ipcMain.handle('export-all', async (_event, pieces, config, baseDir?: string) => {
    const exportBase = baseDir || defaultExportDir

    // Validation du chemin d'export
    validateExportPath(exportBase)

    // Validation de la config
    if (!config || typeof config.radius !== 'number' || config.radius <= 0) {
      throw new Error('Configuration de tampon invalide.')
    }

    // Créer le nom du sous-dossier avec la date du jour
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = now.getFullYear()
    const folderName = `DOSSIER_PIECES_${dd}${mm}${yyyy}`

    let finalDir = join(exportBase, folderName)

    // Si le dossier existe déjà, ajouter un suffixe incrémental
    if (existsSync(finalDir)) {
      let suffix = 2
      while (existsSync(`${finalDir}_${suffix}`) && suffix < 1000) {
        suffix++
      }
      finalDir = `${finalDir}_${suffix}`
    }

    // Export atomique : écrire dans un dossier temporaire, puis renommer
    const tempDir = `${finalDir}_tmp_${randomUUID().slice(0, 8)}`

    try {
      await mkdir(tempDir, { recursive: true })

      for (const piece of pieces) {
        const pdfBuffer = toUint8Array(piece.buffer)

        let finalBuffer: Uint8Array
        if (piece.placements && piece.placements.length > 0) {
          finalBuffer = await applyStamps(pdfBuffer, piece.placements, config)
        } else {
          finalBuffer = pdfBuffer
        }

        // Sanitize le nom de fichier pour éviter les traversées de chemin
        const baseName = sanitizeFileName(piece.fileName.replace(/\.[^.]+$/, ''))
        const lawyerPart = config.lawyerName ? ` ${config.lawyerName}` : ''
        const outputName = `Pièce${lawyerPart} n°${piece.pieceNumber} - ${baseName}.pdf`
        const outputPath = join(tempDir, outputName)

        await writeFile(outputPath, Buffer.from(finalBuffer))
      }

      // Tout a réussi → renommer le dossier temp en dossier final
      await rename(tempDir, finalDir)
      return finalDir
    } catch (err: unknown) {
      // Nettoyage du dossier temporaire en cas d'erreur
      console.error('Erreur export-all:', err)
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
      throw new Error(translateFsError(err))
    }
  })

  // IPC: Obtenir la liste des imprimantes disponibles
  ipcMain.handle('get-printers', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return []
    return await win.webContents.getPrintersAsync()
  })

  // IPC: Imprimer toutes les pieces (chaque piece = un job separe pour agrafage individuel)
  // Utilise pdf-to-printer (SumatraPDF embarque) pour impression fiable
  ipcMain.handle('print-all', async (_event, pieces, config, printSettings) => {
    // Validation minimale
    if (!printSettings || !printSettings.deviceName) {
      throw new Error('Aucune imprimante sélectionnée.')
    }

    const results: Array<{ fileName: string; success: boolean; error?: string }> = []
    const tempFiles: string[] = []

    try {
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i]

        // 1. Convertir le buffer IPC
        let pdfBuffer = toUint8Array(piece.buffer)

        // 2. Appliquer les tampons
        if (piece.placements && piece.placements.length > 0) {
          pdfBuffer = await applyStamps(pdfBuffer, piece.placements, config)
        }

        // 3. Ecrire en fichier temporaire (nom non prévisible)
        const tempPath = join(tmpdir(), `stamp_${randomUUID()}.pdf`)
        await writeFile(tempPath, Buffer.from(pdfBuffer))
        tempFiles.push(tempPath)
        pendingTempFiles.add(tempPath)

        // 4. Imprimer via pdf-to-printer (SumatraPDF embarque)
        try {
          const options: Record<string, unknown> = {
            printer: printSettings.deviceName,
            silent: true
          }
          if (printSettings.copies && printSettings.copies > 1) {
            options.copies = printSettings.copies
          }
          if (printSettings.side) {
            options.side = printSettings.side
          }

          await pdfToPrinter.print(tempPath, options)
          results.push({ fileName: piece.fileName, success: true })
        } catch (printErr: unknown) {
          const errorMsg = printErr instanceof Error ? printErr.message : String(printErr)
          console.error(`Erreur impression ${piece.fileName}:`, errorMsg)
          results.push({ fileName: piece.fileName, success: false, error: errorMsg })
        }

        // Delai entre les pieces pour laisser le spooler traiter
        if (i < pieces.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    } finally {
      // Nettoyage des fichiers temporaires (délai pour le spooler)
      setTimeout(() => {
        for (const f of tempFiles) {
          unlink(f)
            .then(() => pendingTempFiles.delete(f))
            .catch((err) => console.error(`Nettoyage temp échoué (${f}):`, err))
        }
      }, 30000)
    }

    return results
  })

  // IPC: Appliquer les tampons sur un seul PDF
  ipcMain.handle('apply-stamps', async (_event, buffer: Buffer, placements, config) => {
    const pdfBuffer = toUint8Array(buffer)
    const stampedPdf = await applyStamps(pdfBuffer, placements, config)
    return Buffer.from(stampedPdf)
  })

  // IPC: Fusionner deux PDF en un seul
  ipcMain.handle('merge-pdfs', async (_event, buffer1, buffer2) => {
    const pdf1 = toUint8Array(buffer1)
    const pdf2 = toUint8Array(buffer2)
    const merged = await mergePdfs(pdf1, pdf2)
    return Buffer.from(merged)
  })

  // IPC: Scinder un PDF en deux parties
  ipcMain.handle('split-pdf', async (_event, buffer, afterPageIndex: number) => {
    if (typeof afterPageIndex !== 'number' || afterPageIndex < 0) {
      throw new Error('Index de page invalide pour la scission.')
    }
    const pdfBuffer = toUint8Array(buffer)
    const { part1, part2 } = await splitPdf(pdfBuffer, afterPageIndex)
    return { part1: Buffer.from(part1), part2: Buffer.from(part2) }
  })

  createWindow()

  // Activer la mise à jour automatique en production
  if (!is.dev) {
    initAutoUpdater()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Nettoyage des fichiers temporaires restants à la fermeture
app.on('before-quit', () => {
  for (const f of pendingTempFiles) {
    try {
      unlinkSync(f)
    } catch {
      // ignore — le fichier peut avoir été déjà supprimé
    }
  }
  pendingTempFiles.clear()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
