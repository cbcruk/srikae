import { isMatcherName } from './matching.ts'
import { isPlainObject } from './object.ts'
import type { Rule } from './rule.types.ts'

// `new Response` rejects anything outside this range, and it would throw inside
// the interceptor, so an imported rule is checked here instead.
export const MIN_STATUS = 200
export const MAX_STATUS = 599

export function createEmptyRule(): Rule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    endpoint: '/graphql',
    matcher: 'includes',
    operationName: '',
    action: { type: 'mock', data: {} },
  }
}

function isStatus(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_STATUS &&
    value <= MAX_STATUS
  )
}

function isHeaders(value: unknown): boolean {
  return isPlainObject(value) && Object.values(value).every((header) => typeof header === 'string')
}

function isAction(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false
  }

  if (value.type === 'modify' || value.type === 'path') {
    return true
  }

  if (value.type !== 'mock') {
    return false
  }

  return (
    (value.status === undefined || isStatus(value.status)) &&
    (value.headers === undefined || isHeaders(value.headers)) &&
    (value.delayMs === undefined || (typeof value.delayMs === 'number' && value.delayMs >= 0))
  )
}

function isRule(value: unknown): value is Rule {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.endpoint === 'string' &&
    typeof value.operationName === 'string' &&
    (value.matcher === undefined || isMatcherName(value.matcher)) &&
    isAction(value.action)
  )
}

export function parseRules(value: unknown): Rule[] {
  if (!Array.isArray(value) || !value.every(isRule)) {
    throw new Error('Invalid rules file: expected an array of rules.')
  }

  return value
}

export function moveRule(rules: Rule[], id: string, delta: number): Rule[] {
  const index = rules.findIndex((rule) => rule.id === id)
  const target = index + delta

  if (index === -1 || target < 0 || target >= rules.length) {
    return rules
  }

  const next = [...rules]
  const [moved] = next.splice(index, 1)

  next.splice(target, 0, moved)

  return next
}
