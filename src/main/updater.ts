import { autoUpdater } from 'electron-updater'
import { dialog } from 'electron'

/**
 * Initialise la mise à jour automatique via electron-updater.
 *
 * - autoDownload = false : demande confirmation avant téléchargement
 * - Dialogues en français
 * - Silencieux en cas d'erreur (pas d'alerte utilisateur)
 *
 * Appeler cette fonction une seule fois après createWindow() en production.
 */
export function initAutoUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Mise à jour disponible',
        message: `Une nouvelle version (${info.version}) est disponible.\nVoulez-vous la télécharger maintenant ?`,
        buttons: ['Télécharger', 'Plus tard'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Mise à jour prête',
        message:
          "La mise à jour a été téléchargée.\nL'application va redémarrer pour appliquer la mise à jour.",
        buttons: ['Redémarrer maintenant', 'Plus tard'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('Erreur auto-updater:', err)
  })

  // Vérifier les mises à jour après un court délai (laisser l'app démarrer)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Erreur vérification mise à jour:', err)
    })
  }, 3000)
}
