import { RULES_EVENT, type RulesEventDetail } from '../shared/messaging.ts'
import type { Rule } from '../shared/rule.types.ts'
import { getRules, onRulesChanged } from '../shared/storage.ts'

// The ISOLATED world exists solely to bridge chrome.storage (which the MAIN
// world cannot reach) to the interceptor via a CustomEvent.
function pushRules(rules: Rule[]): void {
  const detail: RulesEventDetail = { rules }

  window.dispatchEvent(new CustomEvent(RULES_EVENT, { detail }))
}

void getRules().then(pushRules)

onRulesChanged(pushRules)
