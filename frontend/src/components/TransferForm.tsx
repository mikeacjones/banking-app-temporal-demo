import type { Account } from '../types'

interface TransferFormProps {
  accounts: Account[]
  fromAccount: string
  toAccount: string
  amount: string
  onFromChange: (id: string) => void
  onToChange: (id: string) => void
  onAmountChange: (amount: string) => void
  onNext: () => void
  onBack: () => void
}

export function TransferForm({
  accounts,
  fromAccount,
  toAccount,
  amount,
  onFromChange,
  onToChange,
  onAmountChange,
  onNext,
  onBack,
}: TransferFormProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)

  const canProceed =
    fromAccount && toAccount && fromAccount !== toAccount && parseFloat(amount) > 0

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
          <h1 className="text-lg font-bold">Send Money</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* From account */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            From
          </label>
          <select
            value={fromAccount}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select account</option>
            {accounts
              .filter((a) => a.id !== 'ACC-999')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatCurrency(a.balance)})
                </option>
              ))}
          </select>
        </div>

        {/* To account */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            To
          </label>
          <select
            value={toAccount}
            onChange={(e) => onToChange(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={a.id === fromAccount}>
                {a.name} — {a.owner}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-3 text-2xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2 mb-4">
          {[50, 100, 250, 500].map((val) => (
            <button
              key={val}
              onClick={() => onAmountChange(String(val))}
              className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              ${val}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="p-4 bg-white border-t border-gray-100">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-600/20'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Review Transfer
        </button>
      </div>
    </div>
  )
}
