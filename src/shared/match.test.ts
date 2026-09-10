import { expect, test } from 'vite-plus/test'

import { matchRule } from './match.ts'
import { createPersistedQueryCache } from './persisted.ts'
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

const persisted = (hash: string, rest: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...rest,
  extensions: { persistedQuery: { version: 1, sha256Hash: hash } },
})

test('a persisted query matches a named rule once its hash has been registered', () => {
  const rules = [rule({})]
  const cache = createPersistedQueryCache()

  // Before the handshake there is no name to match on.
  expect(matchRule(rules, URL, persisted('abc'), cache)).toBeUndefined()

  // The registering request carries both, and teaches the cache on its way past.
  matchRule(rules, URL, persisted('abc', { query: 'query GetUser { me }' }), cache)

  expect(matchRule(rules, URL, persisted('abc'), cache)?.id).toBe('r1')
})

test('a persisted query with no name still matches an endpoint-wide rule', () => {
  const rules = [rule({ operationName: '' })]

  expect(matchRule(rules, URL, persisted('abc'))?.id).toBe('r1')
})

test('what one page learned does not leak into another', () => {
  const rules = [rule({})]

  matchRule(rules, URL, persisted('abc', { query: 'query GetUser { me }' }))

  expect(matchRule(rules, URL, persisted('abc'))).toBeUndefined()
})

test('a persisted query still has to satisfy the variables condition', () => {
  const rules = [rule({ matchVariables: { id: '42' } })]
  const cache = createPersistedQueryCache()

  cache.remember('abc', 'GetUser')

  expect(matchRule(rules, URL, persisted('abc', { variables: { id: '42' } }), cache)?.id).toBe('r1')
  expect(matchRule(rules, URL, persisted('abc', { variables: { id: '7' } }), cache)).toBeUndefined()
})

test('a REST body carrying unrelated extensions is not a GraphQL request', () => {
  const rules = [rule({ operationName: '' })]

  expect(matchRule(rules, URL, { id: 1, extensions: { tracing: true } })).toBeUndefined()
})
