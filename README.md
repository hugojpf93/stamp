# STAMP - Tampon Avocat

Application de bureau pour apposer des tampons numérotés sur des pièces PDF, destinée aux avocats. Construite avec Electron, React et TypeScript.

## Fonctionnalités

- **Import multi-fichiers** : PDF, images (JPEG, PNG, TIFF, WebP) et documents Word (DOCX/DOC via LibreOffice ou Microsoft Word)
- **Tampon personnalisable** : nom de l'avocat, ville du barreau, numérotation automatique
- **Gestion des pièces** : réorganisation par glisser, fusion, scission, renommage
- **Export par lot** : génère un dossier `DOSSIER_PIECES_JJMMAAAA` avec toutes les pièces tamponnées
- **Impression directe** : chaque pièce = un job d'impression séparé (agrafage individuel)
- **Mise à jour automatique** : détection et installation des nouvelles versions (electron-updater)
- **Accessibilité** : ARIA labels, focus trap, navigation clavier

## Prérequis

- **Node.js** 18+ et npm
- **Windows** (l'impression utilise pdf-to-printer / SumatraPDF, spécifique Windows)
- **LibreOffice** ou **Microsoft Word** (optionnel, uniquement pour la conversion DOCX/DOC)

## Installation

```bash
git clone <url-du-repo>
cd tampon-main
npm install
```

## Développement

```bash
# Lancer l'application en mode développement (hot-reload)
npm run dev

# Linter (ESLint)
npm run lint
npm run lint:fix

# Formatter (Prettier)
npm run format

# Tests unitaires (Vitest)
npm test
npm run test:watch
```

## Build

```bash
# Compiler et créer l'installateur Windows (NSIS)
npm run build:win
```

L'exécutable sera généré dans le dossier `dist/`.

## Signature de code

Pour distribuer l'application sans avertissements Windows SmartScreen, il est nécessaire de signer l'exécutable avec un certificat de signature de code.

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `CSC_LINK` | Chemin vers le fichier `.pfx` du certificat (ou encodé en base64) |
| `CSC_KEY_PASSWORD` | Mot de passe du certificat |

### Types de certificats

| Type | Prix indicatif | Avantage |
|------|---------------|----------|
| Standard (OV) | ~70-150 EUR/an | Supprime les alertes après quelques téléchargements |
| Extended Validation (EV) | ~350-500 EUR/an | Supprime immédiatement les alertes SmartScreen |

```bash
# Exemple de build signé
CSC_LINK=./cert.pfx CSC_KEY_PASSWORD=monmotdepasse npm run build:win
```

## Mise à jour automatique

L'application utilise `electron-updater` avec un provider `generic`. Pour activer les mises à jour :

1. Modifier l'URL dans `package.json` > `build.publish[0].url` avec l'URL de votre serveur
2. Après chaque build, héberger sur votre serveur :
   - `STAMP Setup X.Y.Z.exe` (l'installateur)
   - `latest.yml` (généré automatiquement par electron-builder)
3. L'application vérifie les mises à jour automatiquement au démarrage

## Architecture

```
src/
  main/           # Process principal Electron (Node.js)
    index.ts      # Point d'entrée, IPC handlers, gestion fenêtre
    helpers.ts    # Utilitaires : validation, sanitization, traduction erreurs
    pdf-service.ts # Manipulation PDF : tampons, fusion, scission, conversion
    updater.ts    # Mise à jour automatique (electron-updater)
  preload/        # Bridge IPC sécurisé (contextBridge)
    index.ts      # API exposée au renderer (typée)
  renderer/       # Interface React (navigateur)
    src/
      App.tsx           # Composant racine, gestion d'état
      components/       # Composants UI
        Toolbar.tsx          # Barre d'outils principale
        PiecesSidebar.tsx    # Liste des pièces avec miniatures
        PdfViewer.tsx        # Visualisation PDF (react-pdf)
        StampOverlay.tsx     # Overlay de placement du tampon
        StampConfigurator.tsx # Configuration du tampon
        StampPreview.tsx     # Aperçu canvas du tampon
        PageNavigator.tsx    # Navigation entre pages
        PrintDialog.tsx      # Dialogue d'impression
      lib/
        coordinate-mapper.ts # Conversion coordonnées écran/PDF
        stamp-renderer.ts    # Rendu canvas du tampon
```

## Tests

Les tests unitaires couvrent :

- **helpers.ts** : validation chemins d'export, sanitization noms de fichiers, traduction erreurs, conversion buffers IPC
- **pdf-service.ts** : conversion image vers PDF, fusion/scission de PDF, application de tampons
- **coordinate-mapper.ts** : conversion coordonnées écran/PDF, aller-retour

```bash
npm test
```

## Licence

MIT
