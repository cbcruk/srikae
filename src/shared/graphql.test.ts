import { expect, test } from 'vite-plus/test'

import { extractOperationName, parseGraphQLRequest } from './graphql.ts'

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
