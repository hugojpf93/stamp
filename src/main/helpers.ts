import { resolve, normalize } from 'path'

/**
 * Convertit un buffer IPC (Buffer, Uint8Array ou objet sérialisé) en Uint8Array.
 */
export function toUint8Array(buffer: unknown): Uint8Array {
  if (Buffer.isBuffer(buffer)) return new Uint8Array(buffer)
  if (buffer instanceof Uint8Array) return buffer
  if (buffer && typeof buffer === 'object') {
    return new Uint8Array(Object.values(buffer) as number[])
  }
  throw new Error('Buffer invalide reçu via IPC')
}

/**
 * Valide que le chemin de sortie est sous un répertoire autorisé
 * (pas un répertoire système comme C:\Windows ou C:\Program Files).
 */
export function validateExportPath(dir: string): void {
  const normalized = normalize(resolve(dir)).toLowerCase()
  const forbidden = [
    normalize('C:\\Windows').toLowerCase(),
    normalize('C:\\Program Files').toLowerCase(),
    normalize('C:\\Program Files (x86)').toLowerCase()
  ]
  for (const f of forbidden) {
    if (normalized.startsWith(f)) {
      throw new Error(`Export impossible vers un répertoire système (${dir}).`)
    }
  }
}

/**
 * Sanitize un nom de fichier en retirant les caractères dangereux.
 */
export function sanitizeFileName(name: string): string {
  // Retirer les traversées de chemin et les caractères interdits Windows
  return (
    name
      .replace(/\.\./g, '_')
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .slice(0, 200)
  )
}

/**
 * Traduit un code d'erreur système en message lisible en français.
 */
export function translateFsError(err: unknown): string {
  const error = err as { code?: string; path?: string; message?: string }
  const fileName = error.path?.split(/[\\/]/).pop() || 'inconnu'

  switch (error.code) {
    case 'EBUSY':
      return `Le fichier "${fileName}" est verrouillé. Fermez-le dans l'autre programme puis réessayez.`
    case 'EACCES':
    case 'EPERM':
      return `Accès refusé au fichier ou dossier "${fileName}". Vérifiez les permissions ou choisissez un autre emplacement.`
    case 'ENOSPC':
      return "Espace disque insuffisant. Libérez de l'espace puis réessayez."
    case 'ENOENT':
      return `Le dossier de destination n'existe plus. Veuillez le recréer ou en choisir un autre.`
    default:
      return error.message || 'Une erreur inattendue est survenue.'
  }
}
