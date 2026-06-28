import { useCallback, useEffect, useState } from 'react'

import type { Rule } from '../../shared/rule.types.ts'
import { getRules, onRulesChanged, setRules } from '../../shared/storage.ts'

export interface UseRulesResult {
  rules: Rule[]
  loading: boolean
  saveRules: (rules: Rule[]) => Promise<void>
}

export function useRules(): UseRulesResult {
  const [rules, setLocalRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getRules().then((stored) => {
      setLocalRules(stored)
      setLoading(false)
    })

    return onRulesChanged(setLocalRules)
  }, [])

  const saveRules = useCallback(async (next: Rule[]): Promise<void> => {
    setLocalRules(next)
    await setRules(next)
  }, [])

  return { rules, loading, saveRules }
}
