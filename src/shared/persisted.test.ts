import { expect, test } from 'vite-plus/test'

import { createPersistedQueryCache } from './persisted.ts'

test('a remembered hash resolves to its operation name', () => {
  const cache = createPersistedQueryCache()

  cache.remember('abc', 'GetUser')

  expect(cache.resolve('abc')).toBe('GetUser')
})

test('an unknown hash resolves to an empty name', () => {
  expect(createPersistedQueryCache().resolve('abc')).toBe('')
})

test('an empty hash or name teaches nothing', () => {
  const cache = createPersistedQueryCache()

  cache.remember('', 'GetUser')
  cache.remember('abc', '')

  expect(cache.resolve('')).toBe('')
  expect(cache.resolve('abc')).toBe('')
})

test('a hash keeps the most recent name it was paired with', () => {
  const cache = createPersistedQueryCache()

  cache.remember('abc', 'Old')
  cache.remember('abc', 'New')

  expect(cache.resolve('abc')).toBe('New')
})

test('the oldest entry is dropped once the cache is full', () => {
  const cache = createPersistedQueryCache(2)

  cache.remember('a', 'A')
  cache.remember('b', 'B')
  cache.remember('c', 'C')

  expect(cache.resolve('a')).toBe('')
  expect(cache.resolve('b')).toBe('B')
  expect(cache.resolve('c')).toBe('C')
})

test('re-teaching the same pair does not age the cache', () => {
  const cache = createPersistedQueryCache(2)

  cache.remember('a', 'A')
  cache.remember('b', 'B')
  cache.remember('a', 'A')
  cache.remember('c', 'C')

  // 'a' is still the oldest, so it is the one that goes.
  expect(cache.resolve('a')).toBe('')
  expect(cache.resolve('b')).toBe('B')
})
