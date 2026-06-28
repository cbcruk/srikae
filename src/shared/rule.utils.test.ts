import { expect, test } from 'vite-plus/test'

import type { Rule } from './rule.types.ts'
import { moveRule } from './rule.utils.ts'

function rule(id: string): Rule {
  return {
    id,
    enabled: true,
    endpoint: '/graphql',
    operationName: id,
    action: { type: 'mock', data: {} },
  }
}

const ids = (rules: Rule[]): string[] => rules.map((r) => r.id)

test('moveRule moves a rule up', () => {
  const rules = [rule('a'), rule('b'), rule('c')]
  expect(ids(moveRule(rules, 'b', -1))).toEqual(['b', 'a', 'c'])
})

test('moveRule moves a rule down', () => {
  const rules = [rule('a'), rule('b'), rule('c')]
  expect(ids(moveRule(rules, 'b', 1))).toEqual(['a', 'c', 'b'])
})

test('moveRule is a no-op at the boundaries', () => {
  const rules = [rule('a'), rule('b')]
  expect(moveRule(rules, 'a', -1)).toBe(rules)
  expect(moveRule(rules, 'b', 1)).toBe(rules)
})

test('moveRule is a no-op for an unknown id', () => {
  const rules = [rule('a')]
  expect(moveRule(rules, 'z', 1)).toBe(rules)
})

test('moveRule does not mutate the input', () => {
  const rules = [rule('a'), rule('b')]
  moveRule(rules, 'a', 1)
  expect(ids(rules)).toEqual(['a', 'b'])
})
