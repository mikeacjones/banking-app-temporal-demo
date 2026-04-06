import type { Account } from '../types'

interface TransferReviewProps {
  accounts: Account[]
  fromAccount: string
  toAccount: string
  amount: number
  onConfirm: () => void
  onBack: () => void
  isLoading: boolean
}

export function TransferReview({
  accounts,
  fromAccount,
  toAccount,
  amount,
  onConfirm,
  onBack,
  isLoading,
}: TransferReviewProps) {
  const from = accounts.find((a) => a.id === fromAccount)
  const to = accounts.find((a) => a.id === toAccount)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white -mt-0.5">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold">Review Transfer</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Amount */}
        <div className="text-center mb-6">
          <p className="text-4xl font-bold text-gray-800">{formatCurrency(amount)}</p>
          <p className="text-sm text-gray-500 mt-1">Transfer amount</p>
        </div>

        {/* From card */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">From</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
              {from?.account_type === 'checking' ? '\u{1F3E6}' : '\u{1F416}'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">{from?.name}</p>
              <p className="text-xs text-gray-500">{from?.owner}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">{formatCurrency(from?.balance ?? 0)}</p>
              <p className="text-[10px] text-gray-400">
                After: {formatCurrency((from?.balance ?? 0) - amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center py-1">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-600">
              <path d="M8 3v10M5 10l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* To card */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">To</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
              {to?.account_type === 'checking' ? '\u{1F3E6}' : '\u{1F416}'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-800">{to?.name}</p>
              <p className="text-xs text-gray-500">{to?.owner}</p>
            </div>
            <p className="text-[10px] text-gray-400 uppercase">{to?.id}</p>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="p-4 bg-white border-t border-gray-100">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
            isLoading
              ? 'bg-blue-400 text-white cursor-wait'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-600/20'
          }`}
        >
          {isLoading ? 'Sending...' : 'Confirm Transfer'}
        </button>
      </div>
    </div>
  )
}
