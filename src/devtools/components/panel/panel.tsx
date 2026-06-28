import { useRef, useState } from 'react'

import type { Rule } from '../../../shared/rule.types.ts'
import { createEmptyRule, moveRule } from '../../../shared/rule.utils.ts'
import { useNetworkCapture } from '../../hooks/use-network-capture.ts'
import { useRules } from '../../hooks/use-rules.ts'
import { CaptureList } from '../capture/capture-list.tsx'
import type { CapturedRequest } from '../capture/capture.types.ts'
import { dataFromResponseText, ruleFromCapture } from '../capture/capture.utils.ts'
import { RuleEditor } from '../rule-editor/rule-editor.tsx'
import { RuleList } from '../rule-list/rule-list.tsx'
import { exportRules, readRulesFile } from './panel.utils.ts'

export function Panel(): React.JSX.Element {
  const { rules, loading, saveRules } = useRules()
  const [draft, setDraft] = useState<Rule | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const { captured, clear, available } = useNetworkCapture(capturing)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleAdd(): void {
    setDraft(createEmptyRule())
  }

  function handleSelect(id: string): void {
    const rule = rules.find((candidate) => candidate.id === id)

    if (rule) {
      setDraft(structuredClone(rule))
    }
  }

  function handleSave(rule: Rule): void {
    const exists = rules.some((candidate) => candidate.id === rule.id)
    const next = exists
      ? rules.map((candidate) => (candidate.id === rule.id ? rule : candidate))
      : [...rules, rule]

    void saveRules(next)
    setDraft(null)
  }

  function handleToggle(id: string): void {
    void saveRules(
      rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)),
    )
  }

  function handleDelete(id: string): void {
    void saveRules(rules.filter((rule) => rule.id !== id))

    if (draft?.id === id) {
      setDraft(null)
    }
  }

  function handleMove(id: string, delta: number): void {
    void saveRules(moveRule(rules, id, delta))
  }

  function handleCreateRule(capture: CapturedRequest): void {
    setDraft(ruleFromCapture(capture))
  }

  function handleMockFromResponse(capture: CapturedRequest): void {
    capture.entry.getContent((content) => {
      setDraft(ruleFromCapture(capture, dataFromResponseText(content)))
    })
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
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

  if (loading) {
    return <p className="empty">Loading…</p>
  }

  return (
    <div className="panel">
      <header className="toolbar">
        <button type="button" onClick={handleAdd}>
          Add rule
        </button>
        <button type="button" onClick={() => exportRules(rules)} disabled={rules.length === 0}>
          Export
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => {
            void handleImport(event)
          }}
        />
        {available ? (
          <button
            type="button"
            className={capturing ? 'capturing' : undefined}
            onClick={() => setCapturing((value) => !value)}
          >
            {capturing ? '◉ Stop capture' : 'Capture'}
          </button>
        ) : null}
      </header>

      {importError ? <p className="error">{importError}</p> : null}

      <div className="layout">
        <div className="left-column">
          <RuleList
            rules={rules}
            selectedId={draft?.id ?? null}
            onSelect={handleSelect}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onMove={handleMove}
          />

          {capturing ? (
            <CaptureList
              captured={captured}
              onCreateRule={handleCreateRule}
              onMockFromResponse={handleMockFromResponse}
              onClear={clear}
            />
          ) : null}
        </div>

        {draft ? (
          <RuleEditor
            key={draft.id}
            rule={draft}
            onSave={handleSave}
            onCancel={() => setDraft(null)}
          />
        ) : (
          <p className="empty">Select a rule or add a new one.</p>
        )}
      </div>
    </div>
  )
}
