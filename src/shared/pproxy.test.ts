import { expect, test } from 'vite-plus/test'

import { fromPproxyRules, looksLikePproxyRules, toPproxyRules } from './pproxy.ts'
import type { PproxyRule } from './pproxy.ts'
import type { Rule } from './rule.types.ts'

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    enabled: true,
    endpoint: '/graphql',
    operationName: 'GetUser',
    action: { type: 'mock', data: { user: { id: '1' } } },
    ...overrides,
  }
}

test('a mock becomes a pproxy rule with a graphql condition', () => {
  expect(toPproxyRules([rule()])).toEqual([
    {
      url_pattern: '*/graphql*',
      graphql: { operation_name: 'GetUser' },
      body: { data: { user: { id: '1' } } },
      name: 'GetUser',
    },
  ])
})

test('the includes matcher becomes a glob that means the same', () => {
  const [converted] = toPproxyRules([rule({ endpoint: '/api/v1[beta]' })])
  expect(converted.url_pattern).toBe('*/api/v1[[]beta]*')
  expect(converted.matcher).toBeUndefined()
})

test('other matchers carry their name across unchanged', () => {
  const [converted] = toPproxyRules([rule({ matcher: 'regex', endpoint: '/graphql$' })])
  expect(converted.url_pattern).toBe('/graphql$')
  expect(converted.matcher).toBe('regex')
})

test('an empty operation name exports an empty condition, not a missing one', () => {
  const [converted] = toPproxyRules([rule({ operationName: '' })])
  expect(converted.graphql).toEqual({})
  expect(converted.name).toBeUndefined()
})

test('mock response controls carry across', () => {
  const [converted] = toPproxyRules([
    rule({
      matchVariables: { id: '42' },
      action: {
        type: 'mock',
        data: {},
        status: 500,
        headers: { 'x-test': '1' },
        delayMs: 300,
      },
    }),
  ])
  expect(converted.graphql).toEqual({ operation_name: 'GetUser', variables: { id: '42' } })
  expect(converted.status_code).toBe(500)
  expect(converted.headers).toEqual({ 'x-test': '1' })
  expect(converted.delay_ms).toBe(300)
})

test('a whole-body mock exports that body rather than an envelope', () => {
  const [converted] = toPproxyRules([
    rule({ action: { type: 'mock', data: { ignored: true }, body: [1, 2] } }),
  ])
  expect(converted.body).toEqual([1, 2])
})

test('modify and path become merge_patch and patches', () => {
  const [modify] = toPproxyRules([rule({ action: { type: 'modify', mergePatch: { a: 1 } } })])
  const [patch] = toPproxyRules([
    rule({ action: { type: 'path', patches: [{ path: 'a[].b', value: 1 }] } }),
  ])
  expect(modify.merge_patch).toEqual({ a: 1 })
  expect(modify.body).toBeUndefined()
  expect(patch.patches).toEqual([{ path: 'a[].b', value: 1 }])
})

test('disabled rules are left out, since pproxy cannot carry the flag', () => {
  expect(toPproxyRules([rule({ enabled: false }), rule({ id: 'r2' })])).toHaveLength(1)
})

test('a pproxy rule imports as an enabled rule with pproxy defaults', () => {
  const { rules, skipped } = fromPproxyRules([
    {
      url_pattern: '*/graphql',
      graphql: { operation_name: 'GetUser', variables: { id: '42' } },
      status_code: 201,
      delay_ms: 50,
      body: { data: { user: null }, errors: [{ message: 'nope' }] },
    },
  ] satisfies PproxyRule[])

  expect(skipped).toEqual([])
  expect(rules[0]).toMatchObject({
    enabled: true,
    endpoint: '*/graphql',
    matcher: 'glob',
    operationName: 'GetUser',
    matchVariables: { id: '42' },
    action: {
      type: 'mock',
      data: { user: null },
      errors: [{ message: 'nope' }],
      status: 201,
      delayMs: 50,
    },
  })
})

test('a body that is not a data/errors envelope imports whole', () => {
  const { rules } = fromPproxyRules([
    { url_pattern: '*/graphql', graphql: {}, body: { data: {}, extensions: { trace: 1 } } },
  ])
  expect(rules[0].action).toEqual({
    type: 'mock',
    data: {},
    body: { data: {}, extensions: { trace: 1 } },
  })
})

test('merge_patch and patches import as their actions', () => {
  const { rules } = fromPproxyRules([
    { url_pattern: '*/graphql', graphql: {}, merge_patch: { a: 1 } },
    { url_pattern: '*/graphql', graphql: {}, patches: [{ path: 'a', value: 1 }] },
  ] satisfies PproxyRule[])
  expect(rules[0].action).toEqual({ type: 'modify', mergePatch: { a: 1 } })
  expect(rules[1].action).toEqual({ type: 'path', patches: [{ path: 'a', value: 1 }] })
})

test('rules this panel cannot represent are reported, not dropped', () => {
  const { rules, skipped } = fromPproxyRules([
    { url_pattern: '*/api/users*', body: {} },
    { url_pattern: '*/graphql', graphql: {}, matcher: 'wildcard' },
    {
      url_pattern: '*/graphql',
      graphql: {},
      merge_patch: { a: 1 },
      patches: [{ path: 'b', value: 2 }],
    },
    { graphql: {} },
  ] as PproxyRule[])

  expect(rules).toEqual([])
  expect(skipped).toEqual([
    { pattern: '*/api/users*', reason: 'not a GraphQL rule' },
    { pattern: '*/graphql', reason: 'unknown matcher "wildcard"' },
    { pattern: '*/graphql', reason: 'combines merge_patch and patches' },
    { pattern: '(unnamed)', reason: 'no url_pattern' },
  ])
})

test('a rule survives a round trip through the pproxy format', () => {
  const original = rule({
    matcher: 'glob',
    endpoint: '*/graphql',
    matchVariables: { id: '7' },
    action: { type: 'mock', data: { user: { id: '7' } }, status: 404 },
  })
  const { rules, skipped } = fromPproxyRules(toPproxyRules([original]))

  expect(skipped).toEqual([])
  expect(rules[0]).toMatchObject({
    endpoint: '*/graphql',
    matcher: 'glob',
    operationName: 'GetUser',
    matchVariables: { id: '7' },
    action: { type: 'mock', data: { user: { id: '7' } }, status: 404 },
  })
})

test('the two formats are told apart by their shape', () => {
  expect(looksLikePproxyRules([{ url_pattern: '*/graphql' }])).toBe(true)
  expect(looksLikePproxyRules([rule()])).toBe(false)
  expect(looksLikePproxyRules([])).toBe(false)
  expect(looksLikePproxyRules({ url_pattern: 'x' })).toBe(false)
})

test('a file that is not an array is rejected', () => {
  expect(() => fromPproxyRules({})).toThrow(/expected an array/)
})
