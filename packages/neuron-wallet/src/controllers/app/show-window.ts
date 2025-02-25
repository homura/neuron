import { BrowserWindow } from 'electron'
import path from 'path'
import env from 'env'
import AppController from '.'

const showWindow = (
  url: string,
  title: string,
  options?: Electron.BrowserWindowConstructorOptions,
  channels?: string[],
  comparator: (win: BrowserWindow) => boolean = (win) => win.getTitle() === title
): BrowserWindow => {
  const opened = BrowserWindow.getAllWindows().find(comparator)
  if (opened) {
    opened.webContents.send('navigation', url.replace(/^#/, ''))
    opened.focus()
    return opened
  } else {
    const win = new BrowserWindow({
      width: 1200,
      minWidth: 900,
      minHeight: 600,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        devTools: env.isDevMode,
        contextIsolation: false,
        preload: path.join(__dirname, './preload.js')
      },
      ...options
    })
    if (channels) {
      AppController.getInstance().registerChannels(win, channels)
    }
    const fmtUrl = url.startsWith('http') || url.startsWith('file:') ? url : env.mainURL + url
    win.loadURL(fmtUrl)
    win.on('ready-to-show', () => {
      win.setTitle(title)
      win.show()
      win.focus()
    })
    return win
  }
}

export { showWindow }
