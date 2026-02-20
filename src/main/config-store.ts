import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

export interface SavedStamp {
  id: string
  name: string
  lawyerName: string
  bottomText: string
}

export interface StampAppConfig {
  lawyerName: string
  bottomText: string
  startNumber: number
  exportDir: string
  savedStamps: SavedStamp[]
  activeStampId: string | null
}

const defaults: StampAppConfig = {
  lawyerName: '',
  bottomText: 'AVOCAT',
  startNumber: 1,
  exportDir: app.getPath('desktop'),
  savedStamps: [],
  activeStampId: null
}

const configPath = join(app.getPath('userData'), 'stamp-config.json')

function readFromDisk(): StampAppConfig {
  try {
    if (!existsSync(configPath)) return { ...defaults }
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...defaults, ...parsed }
  } catch {
    return { ...defaults }
  }
}

function writeToDisk(config: StampAppConfig): void {
  const dir = dirname(configPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function getConfig(): StampAppConfig {
  return readFromDisk()
}

export function setConfig(partial: Partial<StampAppConfig>): void {
  const current = readFromDisk()
  const updated = { ...current }
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) {
      ;(updated as Record<string, unknown>)[key] = value
    }
  }
  writeToDisk(updated)
}

export function getSavedStamps(): SavedStamp[] {
  return readFromDisk().savedStamps || []
}

export function saveStamp(stamp: SavedStamp): void {
  const config = readFromDisk()
  const stamps = config.savedStamps || []
  const idx = stamps.findIndex((s) => s.id === stamp.id)
  if (idx >= 0) {
    stamps[idx] = stamp
  } else {
    stamps.push(stamp)
  }
  writeToDisk({ ...config, savedStamps: stamps })
}

export function deleteStamp(id: string): void {
  const config = readFromDisk()
  const stamps = (config.savedStamps || []).filter((s) => s.id !== id)
  const activeStampId = config.activeStampId === id ? null : config.activeStampId
  writeToDisk({ ...config, savedStamps: stamps, activeStampId })
}
