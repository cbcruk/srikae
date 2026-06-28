import { isPlainObject } from './object.ts'
import type { Rule } from './rule.types.ts'

export function createEmptyRule(): Rule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    endpoint: '/graphql',
    operationName: '',
    action: { type: 'mock', data: {} },
  }
}

function isRule(value: unknown): value is Rule {
  if (!isPlainObject(value)) {
    return false
  }

  const action = value.action

  if (!isPlainObject(action)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.endpoint === 'string' &&
    typeof value.operationName === 'string' &&
    (action.type === 'mock' || action.type === 'modify' || action.type === 'path')
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
