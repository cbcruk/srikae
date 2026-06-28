import { expect, test } from 'vite-plus/test'

import type { CapturedRequest } from './capture.types.ts'
import {
  dataFromResponseText,
  deriveEndpoint,
  parseGraphQLBody,
  ruleFromCapture,
} from './capture.utils.ts'

test('parseGraphQLBody extracts operationName and variables', () => {
  expect(
    parseGraphQLBody(JSON.stringify({ operationName: 'GetUser', variables: { id: '1' } })),
  ).toEqual({ operationName: 'GetUser', variables: { id: '1' } })
})

test('parseGraphQLBody skips batch arrays, non-JSON, and missing operationName', () => {
  expect(parseGraphQLBody(JSON.stringify([{ operationName: 'A' }]))).toBeNull()
  expect(parseGraphQLBody('not json')).toBeNull()
  expect(parseGraphQLBody(JSON.stringify({ query: '{ me }' }))).toBeNull()
  expect(parseGraphQLBody(undefined)).toBeNull()
})

test('deriveEndpoint prefers pathname, falls back to host', () => {
  expect(deriveEndpoint('https://api.example.com/graphql?x=1')).toBe('/graphql')
  expect(deriveEndpoint('https://countries.trevorblades.com/')).toBe('countries.trevorblades.com')
  expect(deriveEndpoint('not a url')).toBe('not a url')
})

test('dataFromResponseText unwraps the GraphQL data envelope', () => {
  expect(dataFromResponseText(JSON.stringify({ data: { me: 1 }, errors: [] }))).toEqual({
    me: 1,
  })
  expect(dataFromResponseText('broken')).toEqual({})
})

test('ruleFromCapture builds a mock rule pre-filled from the capture', () => {
  const capture: CapturedRequest = {
    id: 'c1',
    url: 'https://api.example.com/graphql',
    operationName: 'GetUser',
    variables: { id: '7' },
    entry: {} as chrome.devtools.network.Request,
  }

  const rule = ruleFromCapture(capture, { user: { id: '7' } })

  expect(rule.endpoint).toBe('/graphql')
  expect(rule.operationName).toBe('GetUser')
  expect(rule.matchVariables).toEqual({ id: '7' })
  expect(rule.action).toEqual({ type: 'mock', data: { user: { id: '7' } } })
})
