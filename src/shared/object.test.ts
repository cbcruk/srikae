import { expect, test } from 'vite-plus/test'

import { isSubset, mergePatch } from './object.ts'

test('isSubset matches a deep subset of an object', () => {
  expect(isSubset({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 2 } })).toBe(true)
})

test('isSubset rejects a mismatching value', () => {
  expect(isSubset({ a: 1 }, { a: 2 })).toBe(false)
})

test('isSubset rejects a missing key', () => {
  expect(isSubset({ a: 1 }, { b: 1 })).toBe(false)
})

test('isSubset requires arrays to match by length and order', () => {
  expect(isSubset({ ids: [1, 2] }, { ids: [1, 2] })).toBe(true)
  expect(isSubset({ ids: [1, 2] }, { ids: [1] })).toBe(false)
})

test('mergePatch overwrites nested object values', () => {
  expect(
    mergePatch(
      { data: { user: { status: 'PENDING', name: 'A' } } },
      {
        data: { user: { status: 'CONFIRMED' } },
      },
    ),
  ).toEqual({ data: { user: { status: 'CONFIRMED', name: 'A' } } })
})

test('mergePatch removes keys set to null', () => {
  expect(mergePatch({ a: 1, b: 2 }, { b: null })).toEqual({ a: 1 })
})

test('mergePatch replaces a value when the patch is not an object', () => {
  expect(mergePatch({ a: 1 }, [1, 2])).toEqual([1, 2])
})
