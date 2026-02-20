# STAMP - Tampon Avocat

Application de bureau pour apposer des tampons numérotés sur vos pièces, destinée aux avocats.

## Téléchargement

**[Télécharger STAMP (Windows)](https://github.com/hugojpf93/stamp/releases/latest/download/STAMP-1.0.0-win.zip)**

Dézippez le dossier et lancez `STAMP.exe`. Aucune installation nécessaire.

> **Note** : Au premier lancement, Windows peut afficher un avertissement "Windows a protégé votre ordinateur". Cliquez sur **"Informations complémentaires"** puis **"Exécuter quand même"**. C'est normal, l'application n'a pas de certificat Microsoft.

---

## Fonctionnalités

### Formats pris en charge

- **PDF** : chargés directement
- **Images** : JPEG, PNG, TIFF, WebP (convertis automatiquement en PDF)
- **Documents Word** : DOCX et DOC (nécessite LibreOffice ou Microsoft Word installé sur votre PC)

### Tampon personnalisable

- **Nom de l'avocat** : affiché en haut du tampon (ex: "Me DUPONT")
- **Texte du bas** : entièrement personnalisable (par défaut "AVOCAT", mais vous pouvez mettre "AVOCAT AU BARREAU DE PARIS" ou ce que vous voulez)
- **Numérotation automatique** : chaque tampon est numéroté séquentiellement
- **Numéro de départ** : modifiable si votre numérotation ne commence pas à 1

### Gestion des pièces

- **Import multiple** : chargez plusieurs fichiers en une seule fois
- **Réorganisation** : changez l'ordre des pièces avec les flèches haut/bas
- **Fusion** : combinez deux pièces adjacentes en une seule
- **Scission** : découpez une pièce en deux à l'endroit de votre choix
- **Renommage** : double-cliquez sur le nom d'une pièce pour le modifier

### Export

- Génère un dossier `DOSSIER_PIECES_JJMMAAAA` avec toutes les pièces tamponnées
- Les fichiers sont renommés automatiquement : `Pièce Me DUPONT n°1 - facture.pdf`, `Pièce Me DUPONT n°2 - contrat.pdf`, etc.
- Le numéro correspond au numéro de départ que vous avez configuré

### Impression

- Impression directe depuis l'application
- Chaque pièce est envoyée comme un job d'impression séparé (permet l'agrafage individuel)
- Choix de l'imprimante et des paramètres (recto/verso, copies, etc.)

---

## Comment utiliser STAMP

### 1. Configurer votre tampon

Dans le panneau de droite, renseignez :
- Votre **nom** (ex: "Me DUPONT")
- Le **texte du bas** (ex: "AVOCAT AU BARREAU DE PARIS")
- Le **numéro de départ** si besoin

### 2. Charger vos pièces

Cliquez sur **"Ajouter des pièces"** dans la barre d'outils et sélectionnez vos fichiers (PDF, images, DOCX...). Ils apparaissent dans la liste à gauche.

### 3. Placer les tampons

Cliquez sur une pièce dans la liste de gauche pour l'afficher. Cliquez à l'endroit souhaité sur le document pour poser le tampon. Le numéro s'incrémente automatiquement.

### 4. Exporter

Cliquez sur **"Exporter"**. Un dossier est créé avec toutes vos pièces tamponnées, numérotées et renommées proprement.

---

## Configuration requise

- **Windows** 10 ou 11 (64 bits)
- **LibreOffice** ou **Microsoft Word** (optionnel, uniquement si vous importez des fichiers DOCX/DOC)

---

## Sauvegarde automatique

Votre configuration (nom, texte du barreau, tampons enregistrés) est sauvegardée automatiquement sur votre PC. Vous la retrouvez à chaque ouverture de l'application.

---

## Développement

Pour les développeurs souhaitant contribuer ou modifier l'application.

### Prérequis

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/hugojpf93/stamp.git
cd stamp
npm install
```

### Lancer en mode développement

```bash
npm run dev
```

### Build

```bash
npm run build:win
```

Le fichier `.zip` portable sera généré dans le dossier `dist/`.

### Tests

```bash
npm test
```

### Architecture

```
src/
  main/             # Process principal Electron (Node.js)
    index.ts        # Point d'entrée, IPC handlers
    pdf-service.ts  # Manipulation PDF : tampons, conversion, fusion
    config-store.ts # Sauvegarde de la configuration
    helpers.ts      # Utilitaires : validation, sanitization
  preload/          # Bridge IPC sécurisé
    index.ts        # API exposée au renderer
  renderer/         # Interface React
    src/
      App.tsx                # Composant racine
      components/            # Composants UI
      lib/
        stamp-renderer.ts    # Rendu canvas du tampon
        coordinate-mapper.ts # Conversion coordonnées écran/PDF
```

---

## Licence

MIT
