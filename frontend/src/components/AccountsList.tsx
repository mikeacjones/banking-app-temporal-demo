import { useEffect, useState } from 'react'
import type { Account } from '../types'

interface AccountsListProps {
  onStartTransfer: () => void
}

export function AccountsList({ onStartTransfer }: AccountsListProps) {
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then(setAccounts)
      .catch(() => {})
  }, [])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white -mt-0.5">
        <h1 className="text-lg font-bold">My Accounts</h1>
        <p className="text-blue-100 text-xs">Temporal Banking</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Total balance card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 mb-4 text-white">
          <p className="text-blue-200 text-xs font-medium mb-1">Total Balance</p>
          <p className="text-2xl font-bold">
            {formatCurrency(accounts.reduce((sum, a) => sum + a.balance, 0))}
          </p>
        </div>

        {/* Account cards */}
        <div className="space-y-2.5">
          {accounts
            .filter((a) => a.id !== 'ACC-999')
            .map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      account.account_type === 'checking'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {account.account_type === 'checking' ? '\u{1F3E6}' : '\u{1F416}'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{account.name}</p>
                    <p className="text-xs text-gray-500">{account.owner}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase">{account.id}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Bottom action */}
      <div className="p-4 bg-white border-t border-gray-100">
        <button
          onClick={onStartTransfer}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
        >
          Send Money
        </button>
      </div>
    </div>
  )
}
