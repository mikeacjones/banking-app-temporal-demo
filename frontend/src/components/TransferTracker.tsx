import type { Settings, StepStatus, TransferEvent } from '../types'

interface TransferTrackerProps {
  events: TransferEvent[]
  finalStatus: string | null
  settings: Settings
  onNewTransfer: () => void
}

const PHASES = [
  {
    key: 'validated',
    label: 'Validated',
    icon: '\u{2713}',
    matchSteps: ['validate'],
  },
  {
    key: 'withdrawn',
    label: 'Funds Withdrawn',
    icon: '\u{1F3E6}',
    matchSteps: ['withdraw'],
  },
  {
    key: 'approval',
    label: 'Approval',
    icon: '\u{1F464}',
    matchSteps: ['approval_wait'],
    conditionalScenario: 'human_in_the_loop' as const,
  },
  {
    key: 'deposited',
    label: 'Deposited',
    icon: '\u{1F4B0}',
    matchSteps: ['deposit'],
  },
  {
    key: 'complete',
    label: 'Complete',
    icon: '\u{1F389}',
    matchSteps: ['send_notification_success'],
  },
]

function getPhaseStatus(matchSteps: string[], events: TransferEvent[]): StepStatus {
  const relevant = events.filter((e) => matchSteps.includes(e.step))
  if (relevant.length === 0) return 'pending'

  const lastByStep = new Map<string, TransferEvent>()
  for (const e of relevant) {
    lastByStep.set(e.step, e)
  }
  const statuses = [...lastByStep.values()].map((e) => e.status)

  if (statuses.includes('failed')) return 'failed'
  if (statuses.includes('retrying')) return 'retrying'
  if (statuses.includes('running')) return 'running'
  if (statuses.includes('completed')) return 'completed'
  return 'running'
}

export function TransferTracker({
  events,
  finalStatus,
  settings,
  onNewTransfer,
}: TransferTrackerProps) {
  const hasFailed = finalStatus === 'failed'
  const isComplete = finalStatus === 'completed'
  const isReversed = finalStatus === 'reversed'
  const isDone = hasFailed || isComplete || isReversed

  // Filter phases based on scenario
  const visiblePhases = PHASES.filter(
    (p) => !p.conditionalScenario || p.conditionalScenario === settings.scenario
  )

  // Check retry state
  const depositEvents = events.filter((e) => e.step === 'deposit')
  const lastDepositEvent = depositEvents[depositEvents.length - 1]
  const isActivelyRetrying =
    lastDepositEvent &&
    (lastDepositEvent.status === 'retrying' || lastDepositEvent.status === 'running') &&
    !isDone

  // Active phase index
  let lastActiveIndex = -1
  for (let i = 0; i < visiblePhases.length; i++) {
    const status = getPhaseStatus(visiblePhases[i].matchSteps, events)
    if (status !== 'pending') lastActiveIndex = i
  }

  // Hero status
  let heroEmoji = '\u{23F3}'
  let heroTitle = 'Processing transfer...'
  let heroSubtitle = 'Hang tight!'
  let heroBg = 'bg-blue-50'
  let heroTextColor = 'text-blue-800'
  let heroSubColor = 'text-blue-600'

  if (isComplete) {
    heroEmoji = '\u{2705}'
    heroTitle = 'Transfer Complete!'
    heroSubtitle = 'Funds have been deposited successfully.'
    heroBg = 'bg-green-50'
    heroTextColor = 'text-green-800'
    heroSubColor = 'text-green-600'
  } else if (isReversed) {
    heroEmoji = '\u{1F4B8}'
    heroTitle = 'Transfer Reversed'
    heroSubtitle = 'Funds have been returned to your account. No charges made.'
    heroBg = 'bg-amber-50'
    heroTextColor = 'text-amber-800'
    heroSubColor = 'text-amber-600'
  } else if (hasFailed) {
    heroEmoji = '\u{274C}'
    heroTitle = 'Transfer Failed'
    heroSubtitle = "We couldn't complete this transfer. Please try again."
    heroBg = 'bg-red-50'
    heroTextColor = 'text-red-800'
    heroSubColor = 'text-red-600'
  } else if (isActivelyRetrying) {
    heroEmoji = '\u{1F504}'
    heroTitle = 'Processing transfer...'
    heroSubtitle = 'This may take a moment longer than usual.'
    heroBg = 'bg-yellow-50'
    heroTextColor = 'text-yellow-800'
    heroSubColor = 'text-yellow-600'
  } else if (lastActiveIndex >= 2) {
    heroEmoji = '\u{1F4B3}'
    heroTitle = 'Depositing funds...'
    heroSubtitle = "Almost there!"
  }

  // Check for approval waiting
  const approvalEvents = events.filter((e) => e.step === 'approval_wait')
  const lastApproval = approvalEvents[approvalEvents.length - 1]
  if (lastApproval?.status === 'running' && !isDone) {
    heroEmoji = '\u{1F464}'
    heroTitle = 'Awaiting Approval'
    heroSubtitle = 'A bank employee is reviewing this transfer.'
    heroBg = 'bg-purple-50'
    heroTextColor = 'text-purple-800'
    heroSubColor = 'text-purple-600'
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white -mt-0.5">
        <h1 className="text-lg font-bold">Transfer Status</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero card */}
        <div className={`mx-4 mt-4 mb-5 p-5 ${heroBg} rounded-2xl text-center`}>
          <span className="text-5xl block mb-2">{heroEmoji}</span>
          <h2 className={`text-lg font-bold ${heroTextColor}`}>{heroTitle}</h2>
          <p className={`text-sm mt-1 ${heroSubColor}`}>{heroSubtitle}</p>
        </div>

        {/* Progress tracker */}
        <div className="px-6 mb-4">
          <div className="relative h-9 mx-3">
            {/* Gray track */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[3px] bg-gray-200 rounded-full" />
            {/* Blue progress */}
            {lastActiveIndex >= 0 && (
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-[3px] rounded-full bg-blue-500 transition-all duration-700"
                style={{
                  width: `${
                    ((isDone && isComplete
                      ? visiblePhases.length - 1
                      : Math.min(
                          lastActiveIndex + (isDone ? 1 : 0.5),
                          visiblePhases.length - 1
                        )) /
                      (visiblePhases.length - 1)) *
                    100
                  }%`,
                }}
              />
            )}
            {/* Circles */}
            {visiblePhases.map((phase, i) => {
              const status = getPhaseStatus(phase.matchSteps, events)
              const isActive = i === lastActiveIndex && !isDone
              const isCompleted = status === 'completed'
              const isPast = i < lastActiveIndex || (isDone && isCompleted)

              return (
                <div
                  key={phase.key}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{
                    left: `${(i / (visiblePhases.length - 1)) * 100}%`,
                  }}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-500 ${
                      isPast || isCompleted
                        ? 'bg-blue-500 text-white'
                        : isActive
                          ? status === 'retrying'
                            ? 'bg-yellow-400 text-white animate-pulse ring-3 ring-yellow-200'
                            : status === 'failed'
                              ? 'bg-red-500 text-white ring-3 ring-red-200'
                              : 'bg-blue-500 text-white animate-pulse ring-3 ring-blue-200'
                          : 'bg-gray-100 border-2 border-gray-300 text-gray-400'
                    }`}
                  >
                    {isPast || isCompleted
                      ? '\u{2713}'
                      : isActive && status === 'failed'
                        ? '!'
                        : phase.icon}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Error detail */}
        {isDone && !isComplete && (
          <div className="mx-4 mb-4 px-4 py-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">
              {events
                .filter((e) => e.error)
                .map((e) => e.error)
                .pop() || 'Transfer could not be completed.'}
            </p>
          </div>
        )}

        {/* Transfer info */}
        <div className="mx-4 mb-4 px-4 py-3 bg-gray-50 rounded-xl flex items-center gap-3">
          <span className="text-lg">{'\u{1F512}'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">Temporal Banking</p>
            <p className="text-xs text-gray-500">Secure, durable transfer</p>
          </div>
        </div>
      </div>

      {/* Bottom button */}
      {isDone && (
        <div className="p-4 bg-white border-t border-gray-100">
          <button
            onClick={onNewTransfer}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20"
          >
            New Transfer
          </button>
        </div>
      )}
    </div>
  )
}
