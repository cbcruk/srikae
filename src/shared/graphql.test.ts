import { expect, test } from 'vite-plus/test'

import { extractOperationName, identifyOperation, parseGraphQLRequest } from './graphql.ts'
import { createPersistedQueryCache } from './persisted.ts'

test('extractOperationName reads the name of each operation type', () => {
  expect(extractOperationName('query GetUser { me { id } }')).toBe('GetUser')
  expect(extractOperationName('mutation SignIn($t: String) { signIn(t: $t) }')).toBe('SignIn')
  expect(extractOperationName('subscription OnTick { tick }')).toBe('OnTick')
})

test('extractOperationName skips leading whitespace and comments', () => {
  expect(extractOperationName('\n\n  query  GetUser {\n  me\n}')).toBe('GetUser')
})

test('extractOperationName returns empty for an anonymous operation', () => {
  expect(extractOperationName('{ me { id } }')).toBe('')
  expect(extractOperationName('query { me }')).toBe('')
})

test('extractOperationName takes the first operation of a multi-operation document', () => {
  expect(extractOperationName('query A { a }\nquery B { b }')).toBe('A')
})

test('parseGraphQLRequest prefers the operationName the client sent', () => {
  expect(parseGraphQLRequest({ operationName: 'Sent', query: 'query FromText { a }' })).toEqual({
    operationName: 'Sent',
    variables: undefined,
  })
})

test('parseGraphQLRequest recovers the name from the document text', () => {
  expect(parseGraphQLRequest({ query: 'query GetUser { me }' })).toEqual({
    operationName: 'GetUser',
    variables: undefined,
  })
})

test('parseGraphQLRequest keeps a persisted query that sends only a name', () => {
  expect(parseGraphQLRequest({ operationName: 'GetUser', extensions: {} })).toEqual({
    operationName: 'GetUser',
    variables: undefined,
  })
})

test('parseGraphQLRequest rejects bodies that are not a GraphQL request', () => {
  expect(parseGraphQLRequest({ id: 1, name: 'rest payload' })).toBeNull()
  expect(parseGraphQLRequest([{ query: '{ me }' }])).toBeNull()
  expect(parseGraphQLRequest('query GetUser { me }')).toBeNull()
  expect(parseGraphQLRequest({ query: '   ' })).toBeNull()
})

test('parseGraphQLRequest drops variables that are not an object', () => {
  expect(parseGraphQLRequest({ query: '{ me }', variables: [1, 2] })?.variables).toBeUndefined()
  expect(parseGraphQLRequest({ query: '{ me }', variables: { id: '1' } })?.variables).toEqual({
    id: '1',
  })
})

const apq = (hash: string, rest: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...rest,
  extensions: { persistedQuery: { version: 1, sha256Hash: hash } },
})

test('parseGraphQLRequest treats a persisted query hash as a GraphQL request', () => {
  expect(parseGraphQLRequest(apq('abc', { variables: { id: '1' } }))).toEqual({
    operationName: '',
    variables: { id: '1' },
    persistedQueryHash: 'abc',
  })
})

test('parseGraphQLRequest ignores a persistedQuery block with no hash', () => {
  expect(parseGraphQLRequest({ extensions: { persistedQuery: { version: 1 } } })).toBeNull()
  expect(parseGraphQLRequest({ extensions: { persistedQuery: { sha256Hash: '' } } })).toBeNull()
  expect(parseGraphQLRequest({ extensions: { tracing: true } })).toBeNull()
})

test('identifyOperation learns a hash from the request that registers it', () => {
  const cache = createPersistedQueryCache()
  const registering = parseGraphQLRequest(apq('abc', { query: 'query GetUser { me }' }))!

  expect(identifyOperation(registering, cache)).toBe('GetUser')
  expect(identifyOperation(parseGraphQLRequest(apq('abc'))!, cache)).toBe('GetUser')
})

test('identifyOperation names a later hash-only request from what it learned', () => {
  const cache = createPersistedQueryCache()

  cache.remember('abc', 'GetUser')

  expect(identifyOperation(parseGraphQLRequest(apq('abc'))!, cache)).toBe('GetUser')
})

test('identifyOperation leaves a hash it has never seen unnamed', () => {
  const cache = createPersistedQueryCache()

  expect(identifyOperation(parseGraphQLRequest(apq('unknown'))!, cache)).toBe('')
})

test('identifyOperation leaves a request without a hash alone', () => {
  const cache = createPersistedQueryCache()
  const plain = parseGraphQLRequest({ query: 'query GetUser { me }' })!

  expect(identifyOperation(plain, cache)).toBe('GetUser')
  expect(cache.resolve('abc')).toBe('')
})
