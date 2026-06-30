import { useRef, useState } from 'react'

import type { Rule } from '../shared/rule.types.ts'
import { createEmptyRule, moveRule } from '../shared/rule.utils.ts'
import { exportRules, readRulesFile } from './rule-manager.utils.ts'
import { useRules } from './use-rules.ts'

export interface UseRuleManagerResult {
  rules: Rule[]
  loading: boolean
  draft: Rule | null
  setDraft: React.Dispatch<React.SetStateAction<Rule | null>>
  importError: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  add: () => void
  select: (id: string) => void
  save: (rule: Rule) => void
  toggle: (id: string) => void
  remove: (id: string) => void
  move: (id: string, delta: number) => void
  exportCurrent: () => void
  importFromFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
}

export function useRuleManager(): UseRuleManagerResult {
  const { rules, loading, saveRules } = useRules()
  const [draft, setDraft] = useState<Rule | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function add(): void {
    setDraft(createEmptyRule())
  }

  function select(id: string): void {
    const rule = rules.find((candidate) => candidate.id === id)

    if (rule) {
      setDraft(structuredClone(rule))
    }
  }

  function save(rule: Rule): void {
    const exists = rules.some((candidate) => candidate.id === rule.id)
    const next = exists
      ? rules.map((candidate) => (candidate.id === rule.id ? rule : candidate))
      : [...rules, rule]

    void saveRules(next)
    setDraft(null)
  }

  function toggle(id: string): void {
    void saveRules(
      rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)),
    )
  }

  function remove(id: string): void {
    void saveRules(rules.filter((rule) => rule.id !== id))
    setDraft((current) => (current?.id === id ? null : current))
  }

  function move(id: string, delta: number): void {
    void saveRules(moveRule(rules, id, delta))
  }

  function exportCurrent(): void {
    exportRules(rules)
  }

  async function importFromFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    try {
      await saveRules(await readRulesFile(file))
      setImportError(null)
    } catch (error) {
      setImportError((error as Error).message)
    }
  }

  return {
    rules,
    loading,
    draft,
    setDraft,
    importError,
    fileInputRef,
    add,
    select,
    save,
    toggle,
    remove,
    move,
    exportCurrent,
    importFromFile,
  }
}
