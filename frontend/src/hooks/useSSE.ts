import { useEffect, useRef, useState } from 'react'
import type { TransferEvent } from '../types'

export function useSSE(transferId: string | null) {
  const [events, setEvents] = useState<TransferEvent[]>([])
  const [finalStatus, setFinalStatus] = useState<string | null>(null)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!transferId) {
      setEvents([])
      setFinalStatus(null)
      return
    }

    const source = new EventSource(`/api/transfers/${transferId}/events`)
    sourceRef.current = source

    source.addEventListener('transfer_update', (e) => {
      const event: TransferEvent = JSON.parse(e.data)
      setEvents((prev) => [...prev, event])
    })

    source.addEventListener('transfer_complete', (e) => {
      const data = JSON.parse(e.data)
      setFinalStatus(data.final_status)
      source.close()
    })

    source.addEventListener('timeout', () => {
      source.close()
    })

    source.onerror = () => {
      source.close()
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [transferId])

  const reset = () => {
    sourceRef.current?.close()
    setEvents([])
    setFinalStatus(null)
  }

  return { events, finalStatus, reset }
}
