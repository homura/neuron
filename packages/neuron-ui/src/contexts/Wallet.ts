import { createContext } from 'react'

interface Wallet {
  name: string
  balance: number
  address: string
  publicKey: Uint8Array
  msg: string
}
export const initWallet: Wallet = {
  name: '',
  balance: 0,
  address: '',
  publicKey: new Uint8Array(0),
  msg: '',
}

const WalletContext = createContext<Wallet>(initWallet)
export default WalletContext
