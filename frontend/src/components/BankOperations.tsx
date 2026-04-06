import { useEffect, useState } from 'react'
import type { Settings } from '../types'

interface PendingTransfer {
  transfer_id: string
  from_account: string
  to_account: string
  amount: number
  created_at: string
}

interface BankOperationsProps {
  settings: Settings
}

export function BankOperations({ settings }: BankOperationsProps) {
  const [pendingApprovals, setPendingApprovals] = useState<PendingTransfer[]>([])
  const [processedTransfers, setProcessedTransfers] = useState<Record<string, 'approved' | 'denied'>>({})

  useEffect(() => {
    const poll = () => {
      fetch('/api/bank/pending-approvals')
        .then((r) => r.json())
        .then(setPendingApprovals)
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleApprove = async (transferId: string) => {
    await fetch(`/api/bank/approve/${transferId}`, { method: 'POST' })
    setProcessedTransfers((prev) => ({ ...prev, [transferId]: 'approved' }))
    setPendingApprovals((prev) => prev.filter((p) => p.transfer_id !== transferId))
  }

  const handleDeny = async (transferId: string) => {
    await fetch(`/api/bank/deny/${transferId}`, { method: 'POST' })
    setProcessedTransfers((prev) => ({ ...prev, [transferId]: 'denied' }))
    setPendingApprovals((prev) => prev.filter((p) => p.transfer_id !== transferId))
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const isHITL = settings.scenario === 'human_in_the_loop'

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xl">
            {'\u{1F3E6}'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Bank Operations Center</h1>
            <p className="text-sm text-gray-400">Transfer Approval Dashboard</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isHITL ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-sm text-gray-400">{isHITL ? 'Active' : 'Standby'}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!isHITL ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-5xl mb-4">{'\u{1F512}'}</p>
            <h2 className="text-lg font-bold text-gray-300 mb-2">No Active Approvals</h2>
            <p className="text-sm text-gray-500 max-w-md">
              Switch to the <span className="text-purple-400 font-medium">Human-in-the-Loop</span> scenario
              in settings to see transfers that require manual bank approval.
            </p>
          </div>
        ) : pendingApprovals.length === 0 && Object.keys(processedTransfers).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-5xl mb-4">{'\u{23F3}'}</p>
            <h2 className="text-lg font-bold text-gray-300 mb-2">Waiting for Transfers</h2>
            <p className="text-sm text-gray-500 max-w-md">
              Initiate a transfer from the Customer App tab.
              It will appear here for approval after the withdrawal step.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Pending approvals */}
            {pendingApprovals.map((transfer) => (
              <div
                key={transfer.transfer_id}
                className="bg-gray-800 rounded-xl p-5 border border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 font-mono mb-1">
                      Transfer #{transfer.transfer_id}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(transfer.amount)}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 animate-pulse">
                    Pending Approval
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-4 text-sm">
                  <span className="text-gray-400">{transfer.from_account}</span>
                  <span className="text-gray-600">{'\u{2192}'}</span>
                  <span className="text-gray-400">{transfer.to_account}</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(transfer.transfer_id)}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 active:scale-[0.98] transition-all"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(transfer.transfer_id)}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 active:scale-[0.98] transition-all"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}

            {/* Processed transfers */}
            {Object.entries(processedTransfers).map(([id, decision]) => (
              <div
                key={id}
                className={`rounded-xl p-4 border ${
                  decision === 'approved'
                    ? 'bg-green-900/20 border-green-700/50'
                    : 'bg-red-900/20 border-red-700/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-mono text-gray-400">Transfer #{id}</p>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      decision === 'approved'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {decision === 'approved' ? 'Approved' : 'Denied'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
