# RP Showroom — Guide rapide

## 🚀 Sur Railway (site web)

1. Déploie le projet normalement
2. Dans l'onglet **Variables**, ajoute :
   - `ADMIN_PASSWORD` → ton mot de passe (ex: `MonMotDePasse2024!`)
   - `SESSION_SECRET` → une chaîne aléatoire de 32+ caractères
3. C'est tout — plus besoin de setup au premier lancement !

## 🖥️ En logiciel (Electron / .exe)

### Prérequis
- Node.js 18+

### Installer et lancer
```bash
npm install
npm run electron
```

### Builder le .exe (Windows)
```bash
npm install
npm run build:win
```
Le `.exe` d'installation se trouvera dans `dist/`.

### Variables d'environnement pour l'Electron
Crée un fichier `.env` à la racine (copie `.env.example`) et remplis `ADMIN_PASSWORD`.
