/// <reference types="react-scripts" />
interface Window {
  ethereum?: {
    isMetaMask?: true
    request?: (...args: any[]) => void
    on?: (...args: any[]) => void
    removeListener?: (...args: any[]) => void
    autoRefreshOnNetworkChange?: boolean
  }
  web3?: Record<string, unknown>
}

interface WindowChain {
  ethereum?: {
    isMetaMask?: true
    request?: (...args: any[]) => void
  }
}
