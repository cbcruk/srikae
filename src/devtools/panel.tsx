import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Panel } from './components/panel/panel.tsx'
import '../rules/rule-manager.css'

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(
    <StrictMode>
      <Panel />
    </StrictMode>,
  )
}
