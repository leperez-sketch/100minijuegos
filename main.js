const { app, BrowserWindow } = require('electron')

// 1. Esto "enciende" tu servidor de Express/Socket.io automáticamente
// (Asumo que tu archivo principal del servidor se llama index.js)
require('./index.js') 

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    autoHideMenuBar: true // Oculta el menú superior estilo Windows
  })
  
  // 2. En lugar de cargar un archivo HTML, cargamos la dirección de tu servidor local.
  // IMPORTANTE: Pon aquí el puerto que usa tu servidor (suele ser 3000 u 8080).
  win.loadURL('http://localhost:5000') 
}

app.whenReady().then(() => {
  // Le damos 2 segundos de ventaja al servidor para que arranque antes de abrir la ventana
  setTimeout(createWindow, 2000)
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})