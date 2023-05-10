import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useState as useGlobalState } from 'states'
import { Core } from '@walletconnect/core'
import { SessionTypes } from '@walletconnect/types'
import { IWeb3Wallet, Web3Wallet, Web3WalletTypes } from '@walletconnect/web3wallet'
import { signMessage } from '../../services/remote'
import { isSuccessResponse } from '../../utils'

type SessionRequest = Web3WalletTypes.SessionRequest
type SessionProposal = Web3WalletTypes.SessionProposal

// TODO
const PROJECT_ID = 'a8240ea6d2f605470d2519e5d2e8c1c0'

const Web3WalletContext = createContext<IWeb3Wallet | undefined>(undefined)
const Web3WalletContextProvider: React.FC = ({ children }) => {
  const [web3Wallet, setWeb3Wallet] = useState<IWeb3Wallet>()

  useEffect(() => {
    const core = new Core({
      projectId: PROJECT_ID,
    })

    Web3Wallet.init({
      core,
      metadata: {
        name: 'Neuron',
        url: 'https://github.com/nervosnetwork/neuron',
        icons: [],
        description: '',
      },
    }).then(setWeb3Wallet)
  }, [])

  return (
    <Web3WalletContext.Provider value={web3Wallet}>
      {web3Wallet ? children : 'Waiting for WalletConnect initialized'}
    </Web3WalletContext.Provider>
  )
}

function useWeb3Wallet(): IWeb3Wallet {
  const web3Wallet = useContext(Web3WalletContext)
  if (!web3Wallet) {
    throw new Error('Web3Wallet is not initialized')
  }
  return web3Wallet
}

const SessionProposalModal = ({
  onReject,
  onApprove,
  proposal,
}: {
  proposal: SessionProposal
  onReject: () => void
  onApprove: () => void
}) => {
  return (
    <div style={{ padding: '30px' }}>
      <h3>Session Proposal</h3>

      <div>From: {proposal.context.verified.origin}</div>
      <pre>{JSON.stringify(proposal.params.requiredNamespaces, null, 2)}</pre>

      <button type="button" onClick={onReject}>
        Reject
      </button>
      <button type="button" onClick={onApprove}>
        Approve
      </button>
    </div>
  )
}

const SessionRequestModal = ({
  sessionRequest,
  onApprove,
  onReject,
}: {
  sessionRequest: SessionRequest
  onReject: () => void
  onApprove: () => void
}) => {
  const { wallet } = useGlobalState()
  const web3Wallet = useWeb3Wallet()
  const [password, setPassword] = useState('')
  const { request } = sessionRequest.params

  const walletSignMessage = async () => {
    const [, , address] = request.params[0].split(':')
    const message = request.params[1]

    const res = await signMessage({
      walletID: wallet.id ?? '',
      message,
      password,
      address,
    })

    if (isSuccessResponse(res)) {
      await web3Wallet.respondSessionRequest({
        topic: sessionRequest.topic,
        response: {
          id: sessionRequest.id,
          jsonrpc: '2.0',
          result: res.result,
        },
      })

      onApprove()
    }
  }

  const rejectWalletSignMessage = async () => {
    await web3Wallet.respondSessionRequest({
      topic: sessionRequest.topic,
      response: {
        id: request.params.id,
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'User rejected the signature request',
        },
      },
    })

    onReject()
  }

  return (
    <div style={{ padding: '30px' }}>
      <h3>Session Proposal</h3>

      <div>From: {sessionRequest.context.verified.origin}</div>
      <pre>{JSON.stringify(sessionRequest.params.request, null, 2)}</pre>

      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="button" onClick={rejectWalletSignMessage}>
        Reject
      </button>
      <button type="button" onClick={walletSignMessage}>
        Sign Message
      </button>
    </div>
  )
}

const WalletConnect = () => {
  const { wallet } = useGlobalState()
  const web3Wallet = useWeb3Wallet()
  // WalletConnect URI from QR code
  const [walletConnectUri, setWalletConnectUri] = useState('')
  const [proposal, setProposal] = useState<SessionProposal>()
  const [request, setRequest] = useState<SessionRequest>()

  useEffect(() => {
    web3Wallet.on('session_proposal', setProposal)
    web3Wallet.on('session_request', setRequest)
  }, [])

  async function connect() {
    if (!web3Wallet) {
      return
    }

    try {
      await web3Wallet.core.pairing.pair({ uri: walletConnectUri })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unknown error when pairing')
    }
  }

  const onSessionProposalApprove = async () => {
    if (!proposal) {
      return
    }

    const { id, params } = proposal
    const { requiredNamespaces } = params
    const selectedAccounts = [wallet.addresses[0].address]

    const namespaces: SessionTypes.Namespaces = {}
    Object.keys(requiredNamespaces).forEach((key) => {
      const accounts: string[] = []
      const { chains } = requiredNamespaces[key]
      if (!chains) {
        return
      }

      chains.forEach((chain) => {
        selectedAccounts.map((acc) => accounts.push(`${chain}:${acc}`))
      })
      namespaces[key] = {
        accounts,
        methods: requiredNamespaces[key].methods,
        events: requiredNamespaces[key].events,
      }
    })

    await web3Wallet.approveSession({
      id,
      namespaces,
    })

    setProposal(undefined)
  }

  const onSessionProposalReject = useCallback(() => {
    setProposal(undefined)
  }, [])

  const onSessionRequestApprove = () => {
    setRequest(undefined)
  }

  const onSessionRequestReject = () => {
    setRequest(undefined)
  }

  return (
    <div>
      <h3>WalletConnect</h3>

      <input
        value={walletConnectUri}
        placeholder="e.g. wc:37263660c..."
        onChange={(e) => setWalletConnectUri(e.target.value)}
      />
      <button type="button" onClick={connect}>
        Connect
      </button>

      {proposal && (
        <SessionProposalModal
          proposal={proposal}
          onApprove={onSessionProposalApprove}
          onReject={onSessionProposalReject}
        />
      )}
      {request && (
        <SessionRequestModal
          sessionRequest={request}
          onApprove={onSessionRequestApprove}
          onReject={onSessionRequestReject}
        />
      )}
    </div>
  )
}

const WalletConnectWrapper = () => {
  return (
    <Web3WalletContextProvider>
      <WalletConnect />
    </Web3WalletContextProvider>
  )
}

export default WalletConnectWrapper
