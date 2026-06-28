import { expect, test } from 'vite-plus/test'

import { applyPathPatches, parsePath } from './path.ts'

test('parsePath handles keys, wildcards, and indices', () => {
  expect(parsePath('appointments[].status')).toEqual([
    { type: 'key', key: 'appointments' },
    { type: 'wildcard' },
    { type: 'key', key: 'status' },
  ])
  expect(parsePath('items[0].id')).toEqual([
    { type: 'key', key: 'items' },
    { type: 'index', index: 0 },
    { type: 'key', key: 'id' },
  ])
  expect(parsePath('[].name')).toEqual([{ type: 'wildcard' }, { type: 'key', key: 'name' }])
})

test('parsePath rejects invalid input', () => {
  expect(() => parsePath('items[x]')).toThrow()
  expect(() => parsePath('')).toThrow()
})

test('applyPathPatches maps a value over every array element', () => {
  const input = {
    data: { appointments: [{ status: 'PENDING' }, { status: 'PENDING' }] },
  }

  expect(
    applyPathPatches(input, [{ path: 'data.appointments[].status', value: 'CONFIRMED' }]),
  ).toEqual({
    data: { appointments: [{ status: 'CONFIRMED' }, { status: 'CONFIRMED' }] },
  })
})

test('applyPathPatches does not mutate the original response', () => {
  const input = { data: { items: [{ n: 1 }] } }

  applyPathPatches(input, [{ path: 'data.items[].n', value: 9 }])

  expect(input.data.items[0].n).toBe(1)
})

test('applyPathPatches targets a single index', () => {
  expect(applyPathPatches({ tags: ['a', 'b', 'c'] }, [{ path: 'tags[1]', value: 'B' }])).toEqual({
    tags: ['a', 'B', 'c'],
  })
})

test('applyPathPatches applies multiple patches in order', () => {
  expect(
    applyPathPatches({ a: 1, b: 2 }, [
      { path: 'a', value: 10 },
      { path: 'b', value: 20 },
    ]),
  ).toEqual({ a: 10, b: 20 })
})

test('applyPathPatches is a no-op for paths that do not exist', () => {
  expect(applyPathPatches({ data: null }, [{ path: 'data.user.name', value: 'x' }])).toEqual({
    data: null,
  })
})
