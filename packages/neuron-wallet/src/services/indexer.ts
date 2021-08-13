import env from 'env'
import path from 'path'
import fs from 'fs'
import { ChildProcess, spawn } from 'child_process'
import process from 'process'
import logger from 'utils/logger'
import { Network } from 'models/network'
import { deleteFolderRecursive } from 'block-sync-renderer/sync/indexer-folder-manager'
import NetworksService from './networks'
import MercuryService from './mercury'

const platform = (): string => {
  switch (process.platform) {
    case 'win32':
      return 'win'
    case 'linux':
      return 'linux'
    case 'darwin':
      return 'mac'
    default:
      return ''
  }
}

const { app } = env

export default class IndexerService {
  private indexer: ChildProcess | null = null
  private static instance: IndexerService
  public static PORT = '8118'
  public static LISTEN_URI = `http://localhost:${IndexerService.PORT}`

  public static getInstance = () => {
    if (!IndexerService.instance) {
      IndexerService.instance = new IndexerService()
    }
    return IndexerService.instance
  }

  static getPath = (): string => {
    return app.isPackaged ?
      path.join(path.dirname(app.getAppPath()), '..', './bin') :
      path.join(__dirname, '../../bin',)
  }

  static getBinary = (): string => {
    const binary = app.isPackaged ?
      path.resolve(IndexerService.getPath(), './ckb-indexer') :
      path.resolve(IndexerService.getPath(), `./${platform()}`, './ckb-indexer')
    return platform() === 'win' ? binary + '.exe' : binary
  }

  getDataPath = (network: Network): string => {
    return app.isPackaged ?
      path.resolve(app.getPath('userData'), './ckb-indexer', './data', `./${network.genesisHash}`) :
      path.resolve(app.getPath('userData'), './dev', './ckb-indexer', './data', `./${network.genesisHash}`)
  }

  async stop() {
    return new Promise<void>(_resolve => {
      const resolve = () => {
        this.indexer?.removeAllListeners()
        _resolve()
      }
      if (this.indexer) {
        logger.info('Indexer:\tkilling')
        this.indexer.once('close', () => resolve())
        this.indexer.kill()
        this.indexer = null
      } else {
        resolve()
      }
    })
  }

  start = async () => {
    const network = NetworksService.getInstance().getCurrent()
    await this.stop()
    logger.info('Indexer:\tstart...')
    const dataPath = this.getDataPath(network)
    MercuryService.createFolder(dataPath)

    this.indexer = spawn(IndexerService.getBinary(), ['-c', network.remote, '-s', dataPath, '-l', `127.0.0.1:${IndexerService.PORT}`])
    this.indexer.stderr && this.indexer.stderr.on('data', data => {
      logger.error('Indexer:\trun fail:', data.toString())
      this.indexer = null
    })

    this.indexer.on('error', error => {
      logger.error('Indexer:\trun fail:', error)
      this.indexer = null
    })

    this.indexer.on('close', () => {
      logger.info('Indexer:\tprocess closed')
      this.indexer = null
    })
  }

  clearData = async () => {
    const network = NetworksService.getInstance().getCurrent()
    await this.stop()
    const dataPath = this.getDataPath(network)
    deleteFolderRecursive(dataPath)
  }

  static createFolder(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
