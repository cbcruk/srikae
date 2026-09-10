import { fromPproxyRules, looksLikePproxyRules, toPproxyRules } from '../shared/pproxy.ts'
import type { SkippedRule } from '../shared/pproxy.ts'
import type { Rule } from '../shared/rule.types.ts'
import { parseRules } from '../shared/rule.utils.ts'

export interface ImportResult {
  rules: Rule[]
  skipped: SkippedRule[]
}

function download(name: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = name
  anchor.click()

  URL.revokeObjectURL(url)
}

export function exportRules(rules: Rule[]): void {
  download('gqlmock-rules.json', rules)
}

// pproxy's own file name, so the export drops straight into `pproxy run`.
export function exportPproxyRules(rules: Rule[]): void {
  download('rules.json', toPproxyRules(rules))
}

// Takes either format. The panel's own export round-trips exactly; a pproxy
// file is converted, and whatever could not come across is reported.
export async function readRulesFile(file: File): Promise<ImportResult> {
  const value = JSON.parse(await file.text()) as unknown

  if (looksLikePproxyRules(value)) {
    return fromPproxyRules(value)
  }

  return { rules: parseRules(value), skipped: [] }
}
