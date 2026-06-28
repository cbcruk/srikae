import { useCallback, useEffect, useState } from 'react'

import type { CapturedRequest } from '../components/capture/capture.types.ts'
import { parseGraphQLBody } from '../components/capture/capture.utils.ts'

const MAX_CAPTURED = 50

export interface UseNetworkCaptureResult {
  captured: CapturedRequest[]
  clear: () => void
  available: boolean
}

export function useNetworkCapture(enabled: boolean): UseNetworkCaptureResult {
  const [captured, setCaptured] = useState<CapturedRequest[]>([])
  const available = Boolean(chrome.devtools?.network)

  useEffect(() => {
    if (!enabled || !available) {
      return
    }

    const network = chrome.devtools.network

    const listener = (entry: chrome.devtools.network.Request): void => {
      if (entry.request.method !== 'POST') {
        return
      }

      const operation = parseGraphQLBody(entry.request.postData?.text)

      if (!operation) {
        return
      }

      const item: CapturedRequest = {
        id: crypto.randomUUID(),
        url: entry.request.url,
        ...operation,
        entry,
      }

      setCaptured((prev) => [item, ...prev].slice(0, MAX_CAPTURED))
    }

    network.onRequestFinished.addListener(listener)

    return () => {
      network.onRequestFinished.removeListener(listener)
    }
  }, [enabled, available])

  const clear = useCallback((): void => {
    setCaptured([])
  }, [])

  return { captured, clear, available }
}
