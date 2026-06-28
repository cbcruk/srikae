import { expect, test } from 'vite-plus/test'

import { matchRule } from './match.ts'
import type { Rule } from './rule.types.ts'

function rule(overrides: Partial<Rule>): Rule {
  return {
    id: 'r1',
    enabled: true,
    endpoint: '/graphql',
    operationName: 'GetUser',
    action: { type: 'mock', data: {} },
    ...overrides,
  }
}

const URL = 'https://api.example.com/graphql'

test('matches by endpoint substring and operationName', () => {
  const rules = [rule({})]
  expect(matchRule(rules, URL, { operationName: 'GetUser' })).toBe(rules[0])
})

test('passthrough when operationName differs', () => {
  expect(matchRule([rule({})], URL, { operationName: 'Other' })).toBeUndefined()
})

test('passthrough for disabled rules', () => {
  expect(matchRule([rule({ enabled: false })], URL, { operationName: 'GetUser' })).toBeUndefined()
})

test('passthrough for batch arrays (non-object body)', () => {
  expect(matchRule([rule({})], URL, [{ operationName: 'GetUser' }])).toBeUndefined()
})

test('passthrough when operationName is absent (e.g. persisted query)', () => {
  expect(matchRule([rule({})], URL, { query: '{ me }' })).toBeUndefined()
})

test('matchVariables narrows by deep subset', () => {
  const rules = [rule({ matchVariables: { id: '42' } })]
  expect(matchRule(rules, URL, { operationName: 'GetUser', variables: { id: '42', n: 1 } })).toBe(
    rules[0],
  )
  expect(
    matchRule(rules, URL, { operationName: 'GetUser', variables: { id: '7' } }),
  ).toBeUndefined()
})

test('first enabled match wins (rule order matters)', () => {
  const first = rule({ id: 'a', action: { type: 'mock', data: { tag: 'a' } } })
  const second = rule({ id: 'b', action: { type: 'mock', data: { tag: 'b' } } })
  expect(matchRule([first, second], URL, { operationName: 'GetUser' })).toBe(first)
})
