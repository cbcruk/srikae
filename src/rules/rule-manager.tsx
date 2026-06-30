import { RuleEditor } from './rule-editor/rule-editor.tsx'
import { RuleList } from './rule-list/rule-list.tsx'
import type { UseRuleManagerResult } from './use-rule-manager.ts'

export interface RuleManagerProps {
  manager: UseRuleManagerResult
  layout?: 'split' | 'stacked'
  toolbarExtra?: React.ReactNode
  listExtra?: React.ReactNode
}

export function RuleManager({
  manager,
  layout = 'split',
  toolbarExtra,
  listExtra,
}: RuleManagerProps): React.JSX.Element {
  const {
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
  } = manager

  if (loading) {
    return <p className="empty">Loading…</p>
  }

  return (
    <div className="panel">
      <header className="toolbar">
        <button type="button" onClick={add}>
          Add rule
        </button>
        <button type="button" onClick={exportCurrent} disabled={rules.length === 0}>
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
            void importFromFile(event)
          }}
        />
        {toolbarExtra}
      </header>

      {importError ? <p className="error">{importError}</p> : null}

      <div className={layout === 'stacked' ? 'layout stacked' : 'layout'}>
        <div className="left-column">
          <RuleList
            rules={rules}
            selectedId={draft?.id ?? null}
            onSelect={select}
            onToggle={toggle}
            onDelete={remove}
            onMove={move}
          />

          {listExtra}
        </div>

        {draft ? (
          <RuleEditor key={draft.id} rule={draft} onSave={save} onCancel={() => setDraft(null)} />
        ) : (
          <p className="empty">Select a rule or add a new one.</p>
        )}
      </div>
    </div>
  )
}
