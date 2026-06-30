import type { Rule } from '../shared/rule.types.ts'
import { parseRules } from '../shared/rule.utils.ts'

export function exportRules(rules: Rule[]): void {
  const blob = new Blob([JSON.stringify(rules, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'gqlmock-rules.json'
  anchor.click()

  URL.revokeObjectURL(url)
}

export async function readRulesFile(file: File): Promise<Rule[]> {
  const text = await file.text()

  return parseRules(JSON.parse(text))
}
