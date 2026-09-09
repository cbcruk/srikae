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

test('recovers operationName from the query text when the field is missing', () => {
  const rules = [rule({})]
  expect(matchRule(rules, URL, { query: 'query GetUser { me { id } }' })).toBe(rules[0])
})

test('passthrough for an anonymous document against a named rule', () => {
  expect(matchRule([rule({})], URL, { query: '{ me { id } }' })).toBeUndefined()
})

test('an empty operationName takes every operation on the endpoint', () => {
  const rules = [rule({ operationName: '' })]
  expect(matchRule(rules, URL, { operationName: 'GetUser' })).toBe(rules[0])
  expect(matchRule(rules, URL, { operationName: 'SignIn' })).toBe(rules[0])
  expect(matchRule(rules, URL, { query: '{ me }' })).toBe(rules[0])
})

test('an endpoint-wide rule still ignores non-GraphQL bodies', () => {
  expect(matchRule([rule({ operationName: '' })], URL, { id: 1, note: 'rest' })).toBeUndefined()
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

test('the matcher decides how the endpoint is compared', () => {
  const body = { operationName: 'GetUser' }
  const decoy = 'https://api.example.com/graphql/internal/rest'

  expect(matchRule([rule({ matcher: 'includes' })], decoy, body)).toBeDefined()
  expect(matchRule([rule({ endpoint: '*/graphql', matcher: 'glob' })], decoy, body)).toBeUndefined()
  expect(matchRule([rule({ endpoint: '*/graphql', matcher: 'glob' })], URL, body)).toBeDefined()
  expect(matchRule([rule({ endpoint: URL, matcher: 'exact' })], URL, body)).toBeDefined()
  expect(matchRule([rule({ endpoint: 'graphql$', matcher: 'regex' })], URL, body)).toBeDefined()
})
