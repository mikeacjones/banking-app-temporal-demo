import type { Settings, TransferScenario } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: Settings
  onSave: (s: Settings) => void
}

const SCENARIOS: {
  value: TransferScenario
  label: string
  description: string
  color: string
}[] = [
  {
    value: 'happy_path',
    label: 'Happy Path',
    description: 'Standard transfer — everything succeeds',
    color: 'green',
  },
  {
    value: 'advanced_visibility',
    label: 'Advanced Visibility',
    description: 'Updates search attributes at each workflow step',
    color: 'blue',
  },
  {
    value: 'human_in_the_loop',
    label: 'Human-in-the-Loop',
    description: 'Pauses for bank employee approval with 30s timeout',
    color: 'purple',
  },
  {
    value: 'api_downtime',
    label: 'API Downtime',
    description: 'Deposit fails ~5 times then recovers automatically',
    color: 'yellow',
  },
  {
    value: 'bug_in_workflow',
    label: 'Bug in Workflow',
    description: 'Intentional error — demonstrates versioning/patching',
    color: 'red',
  },
  {
    value: 'invalid_account',
    label: 'Invalid Account',
    description: 'Non-retryable failure — immediate fail on validation',
    color: 'red',
  },
]

const COLOR_MAP: Record<string, string> = {
  green: 'border-green-500 bg-green-500/10',
  blue: 'border-blue-500 bg-blue-500/10',
  purple: 'border-purple-500 bg-purple-500/10',
  yellow: 'border-yellow-500 bg-yellow-500/10',
  red: 'border-red-500 bg-red-500/10',
}

const COLOR_MAP_ACTIVE: Record<string, string> = {
  green: 'border-green-400 bg-green-500/20 ring-2 ring-green-500/30',
  blue: 'border-blue-400 bg-blue-500/20 ring-2 ring-blue-500/30',
  purple: 'border-purple-400 bg-purple-500/20 ring-2 ring-purple-500/30',
  yellow: 'border-yellow-400 bg-yellow-500/20 ring-2 ring-yellow-500/30',
  red: 'border-red-400 bg-red-500/20 ring-2 ring-red-500/30',
}

export function SettingsModal({ open, onClose, settings, onSave }: SettingsModalProps) {
  if (!open) return null

  const handleSelectScenario = (scenario: TransferScenario) => {
    onSave({ ...settings, scenario })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-[450px] max-h-[80vh] overflow-y-auto border border-gray-700">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white">Demo Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl transition-colors"
          >
            {'\u{2715}'}
          </button>
        </div>

        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">
          Transfer Scenario
        </p>

        <div className="space-y-2">
          {SCENARIOS.map((s) => {
            const isActive = settings.scenario === s.value
            return (
              <button
                key={s.value}
                onClick={() => handleSelectScenario(s.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  isActive ? COLOR_MAP_ACTIVE[s.color] : `${COLOR_MAP[s.color]} opacity-60 hover:opacity-90`
                }`}
              >
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-white flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-200">{s.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">
            Presentation
          </p>
          <div className="flex gap-2">
            {(['simple', 'detailed'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onSave({ ...settings, presentation_mode: mode })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  settings.presentation_mode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {mode === 'simple' ? 'Simple' : 'Detailed'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
