import { deriveEndpoint } from './capture.utils.ts'
import type { CapturedRequest } from './capture.types.ts'

export interface CaptureListProps {
  captured: CapturedRequest[]
  onCreateRule: (capture: CapturedRequest) => void
  onMockFromResponse: (capture: CapturedRequest) => void
  onClear: () => void
}

export function CaptureList({
  captured,
  onCreateRule,
  onMockFromResponse,
  onClear,
}: CaptureListProps): React.JSX.Element {
  return (
    <section className="capture">
      <header className="capture-header">
        <span>Captured operations ({captured.length})</span>
        <button type="button" onClick={onClear} disabled={captured.length === 0}>
          Clear
        </button>
      </header>

      {captured.length === 0 ? (
        <p className="empty">Browse the inspected page to capture GraphQL operations.</p>
      ) : (
        <ul className="capture-list">
          {captured.map((capture) => (
            <li key={capture.id} className="capture-item">
              <div className="capture-meta">
                <span className="rule-op">{capture.operationName}</span>
                <span className="rule-endpoint">{deriveEndpoint(capture.url)}</span>
              </div>
              <div className="capture-actions">
                <button type="button" onClick={() => onCreateRule(capture)}>
                  + rule
                </button>
                <button type="button" onClick={() => onMockFromResponse(capture)}>
                  mock from response
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
