import type { Rule } from '../../../shared/rule.types.ts'

export interface RuleListProps {
  rules: Rule[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, delta: number) => void
}

export function RuleList({
  rules,
  selectedId,
  onSelect,
  onToggle,
  onDelete,
  onMove,
}: RuleListProps): React.JSX.Element {
  if (rules.length === 0) {
    return <p className="empty">No rules yet. Add one to start mocking.</p>
  }

  return (
    <ol className="rule-list">
      {rules.map((rule, index) => (
        <li key={rule.id} className={rule.id === selectedId ? 'rule-item selected' : 'rule-item'}>
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
            aria-label="Enable rule"
          />
          <button type="button" className="rule-summary" onClick={() => onSelect(rule.id)}>
            <span className="rule-op">{rule.operationName || '(unnamed)'}</span>
            <span className={`rule-badge badge-${rule.action.type}`}>{rule.action.type}</span>
            <span className="rule-endpoint">{rule.endpoint}</span>
          </button>
          <div className="rule-move">
            <button
              type="button"
              onClick={() => onMove(rule.id, -1)}
              disabled={index === 0}
              aria-label="Move rule up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onMove(rule.id, 1)}
              disabled={index === rules.length - 1}
              aria-label="Move rule down"
            >
              ↓
            </button>
          </div>
          <button
            type="button"
            className="rule-delete"
            onClick={() => onDelete(rule.id)}
            aria-label="Delete rule"
          >
            ✕
          </button>
        </li>
      ))}
    </ol>
  )
}
