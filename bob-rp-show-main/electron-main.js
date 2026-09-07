const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require('electron')
const path = require('path')
const { fork } = require('child_process')

let mainWindow = null
let splashWindow = null
let tray = null
let serverProcess = null
let serverReady = false
const PORT = process.env.PORT || 4000

// ── DÉMARRER LE SERVEUR NODE ──────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    serverProcess = fork(path.join(__dirname, 'src/index.js'), [], {
      env: { ...process.env, PORT },
      silent: true
    })
    serverProcess.stdout.on('data', (d) => {
      const msg = d.toString()
      console.log('[server]', msg)
      if (msg.includes('Panel') || msg.includes('4000') || msg.includes('http')) {
        resolve()
      }
    })
    serverProcess.stderr.on('data', (d) => console.error('[server-err]', d.toString()))
    serverProcess.on('exit', (code) => {
      console.log('[server] exited', code)
    })
    // Fallback : si pas de log en 3s, on tente quand même
    setTimeout(resolve, 3000)
  })
}

// ── SPLASH SCREEN ─────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false }
  })
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', sans-serif;
    background: transparent;
    display: flex; align-items: center; justify-content: center;
    height: 100vh;
  }
  .card {
    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
    border: 1px solid rgba(99,102,241,0.4);
    border-radius: 20px;
    padding: 40px 50px;
    text-align: center;
    box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 80px rgba(99,102,241,0.15);
    width: 380px;
  }
  .logo { font-size: 52px; margin-bottom: 12px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  h1 { color: #e2e8f0; font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .sub { color: #6366f1; font-size: 13px; margin-bottom: 28px; font-weight: 500; }
  .bar-wrap { background: rgba(255,255,255,0.06); border-radius: 999px; height: 5px; overflow: hidden; }
  .bar { height: 100%; background: linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa); border-radius:999px;
    animation: load 2.5s ease-in-out forwards; width:0 }
  @keyframes load { 0%{width:0} 60%{width:70%} 80%{width:85%} 100%{width:100%} }
  .status { color: #94a3b8; font-size: 12px; margin-top: 14px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">🎮</div>
  <h1>RP Showroom</h1>
  <div class="sub">Panel de gestion multi-bots</div>
  <div class="bar-wrap"><div class="bar"></div></div>
  <div class="status">Démarrage du serveur...</div>
</div>
</body>
</html>
`)}`)
}

// ── FENÊTRE PRINCIPALE ────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f1a',
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js')
    },
    show: false
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.close(); splashWindow = null }
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // Ouvrir les liens externes dans le navigateur
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── TRAY ──────────────────────────────────────────────────────
function createTray() {
  // Tray icon générique
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  const menu = Menu.buildFromTemplate([
    { label: '🎮 RP Showroom', enabled: false },
    { type: 'separator' },
    { label: 'Ouvrir', click: () => { if (mainWindow) mainWindow.show(); else createMainWindow() } },
    { label: 'Ouvrir dans le navigateur', click: () => shell.openExternal(`http://localhost:${PORT}`) },
    { type: 'separator' },
    { label: 'Quitter', click: () => { app.isQuiting = true; app.quit() } }
  ])
  tray.setToolTip('RP Showroom')
  tray.setContextMenu(menu)
  tray.on('double-click', () => { if (mainWindow) mainWindow.show() })
}

// ── IPC : contrôles fenêtre ───────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize() })
ipcMain.on('window-close',    () => mainWindow?.hide()) // hide dans tray

// ── APP ───────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash()
  await startServer()
  createMainWindow()
  createTray()
})

app.on('window-all-closed', (e) => e.preventDefault()) // reste dans tray

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill()
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})
