import { describe, it, expect } from 'vitest'
import { toUint8Array, validateExportPath, sanitizeFileName, translateFsError } from '../helpers'

describe('toUint8Array', () => {
  it('converts a Buffer to Uint8Array', () => {
    const buf = Buffer.from([1, 2, 3])
    const result = toUint8Array(buf)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([1, 2, 3])
  })

  it('returns Uint8Array as-is', () => {
    const arr = new Uint8Array([4, 5, 6])
    const result = toUint8Array(arr)
    expect(result).toBe(arr)
  })

  it('converts a serialized object to Uint8Array', () => {
    const obj = { 0: 10, 1: 20, 2: 30 }
    const result = toUint8Array(obj)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([10, 20, 30])
  })

  it('throws on null', () => {
    expect(() => toUint8Array(null)).toThrow('Buffer invalide')
  })

  it('throws on string', () => {
    expect(() => toUint8Array('abc')).toThrow('Buffer invalide')
  })

  it('throws on number', () => {
    expect(() => toUint8Array(42)).toThrow('Buffer invalide')
  })
})

describe('validateExportPath', () => {
  it('accepts a normal path', () => {
    expect(() => validateExportPath('C:\\Users\\test\\Documents')).not.toThrow()
  })

  it('accepts Desktop path', () => {
    expect(() => validateExportPath('D:\\Export')).not.toThrow()
  })

  it('rejects C:\\Windows', () => {
    expect(() => validateExportPath('C:\\Windows\\Temp')).toThrow('répertoire système')
  })

  it('rejects C:\\Program Files', () => {
    expect(() => validateExportPath('C:\\Program Files\\MyApp')).toThrow('répertoire système')
  })

  it('rejects C:\\Program Files (x86)', () => {
    expect(() => validateExportPath('C:\\Program Files (x86)\\Test')).toThrow('répertoire système')
  })

  it('is case-insensitive', () => {
    expect(() => validateExportPath('c:\\windows\\system32')).toThrow('répertoire système')
  })
})

describe('sanitizeFileName', () => {
  it('returns a normal name unchanged', () => {
    expect(sanitizeFileName('rapport-2024.pdf')).toBe('rapport-2024.pdf')
  })

  it('replaces path traversal (..)', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('____etc_passwd')
  })

  it('replaces forbidden Windows characters', () => {
    expect(sanitizeFileName('file<>:"/\\|?*.txt')).toBe('file_________.txt')
  })

  it('replaces control characters', () => {
    expect(sanitizeFileName('file\x00name\x1f.pdf')).toBe('file_name_.pdf')
  })

  it('truncates to 200 characters', () => {
    const longName = 'a'.repeat(300)
    expect(sanitizeFileName(longName).length).toBe(200)
  })
})

describe('translateFsError', () => {
  it('translates EBUSY to French', () => {
    const err = { code: 'EBUSY', path: 'C:\\docs\\rapport.pdf' }
    const msg = translateFsError(err)
    expect(msg).toContain('verrouillé')
    expect(msg).toContain('rapport.pdf')
  })

  it('translates EACCES to French', () => {
    const err = { code: 'EACCES', path: 'C:\\protected\\file.pdf' }
    const msg = translateFsError(err)
    expect(msg).toContain('Accès refusé')
  })

  it('translates EPERM to French (same as EACCES)', () => {
    const err = { code: 'EPERM', path: '/some/file' }
    const msg = translateFsError(err)
    expect(msg).toContain('Accès refusé')
  })

  it('translates ENOSPC to French', () => {
    const err = { code: 'ENOSPC' }
    const msg = translateFsError(err)
    expect(msg).toContain('Espace disque insuffisant')
  })

  it('translates ENOENT to French', () => {
    const err = { code: 'ENOENT' }
    const msg = translateFsError(err)
    expect(msg).toContain("n'existe plus")
  })

  it('falls back to error.message for unknown codes', () => {
    const err = { code: 'UNKNOWN', message: 'Something went wrong' }
    expect(translateFsError(err)).toBe('Something went wrong')
  })

  it('returns default message when no message available', () => {
    const err = { code: 'UNKNOWN' }
    expect(translateFsError(err)).toBe('Une erreur inattendue est survenue.')
  })
})
