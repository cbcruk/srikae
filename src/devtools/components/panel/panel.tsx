import { useState } from 'react'

import { RuleManager } from '../../../rules/rule-manager.tsx'
import { useRuleManager } from '../../../rules/use-rule-manager.ts'
import { useNetworkCapture } from '../../hooks/use-network-capture.ts'
import { CaptureList } from '../capture/capture-list.tsx'
import type { CapturedRequest } from '../capture/capture.types.ts'
import { dataFromResponseText, ruleFromCapture } from '../capture/capture.utils.ts'

export function Panel(): React.JSX.Element {
  const manager = useRuleManager()
  const [capturing, setCapturing] = useState(false)
  const { captured, clear, available } = useNetworkCapture(capturing)

  function handleCreateRule(capture: CapturedRequest): void {
    manager.setDraft(ruleFromCapture(capture))
  }

  function handleMockFromResponse(capture: CapturedRequest): void {
    capture.entry.getContent((content) => {
      manager.setDraft(ruleFromCapture(capture, dataFromResponseText(content)))
    })
  }

  return (
    <RuleManager
      manager={manager}
      toolbarExtra={
        available ? (
          <button
            type="button"
            className={capturing ? 'capturing' : undefined}
            onClick={() => setCapturing((value) => !value)}
          >
            {capturing ? '◉ Stop capture' : 'Capture'}
          </button>
        ) : null
      }
      listExtra={
        capturing ? (
          <CaptureList
            captured={captured}
            onCreateRule={handleCreateRule}
            onMockFromResponse={handleMockFromResponse}
            onClear={clear}
          />
        ) : null
      }
    />
  )
}
