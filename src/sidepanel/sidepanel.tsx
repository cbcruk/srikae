import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { RuleManager } from '../rules/rule-manager.tsx'
import { useRuleManager } from '../rules/use-rule-manager.ts'
import '../rules/rule-manager.css'

function SidePanel(): React.JSX.Element {
  const manager = useRuleManager()

  return <RuleManager manager={manager} layout="stacked" />
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(
    <StrictMode>
      <SidePanel />
    </StrictMode>,
  )
}
