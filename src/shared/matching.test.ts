import { expect, test } from 'vite-plus/test'

import { matchUrl, patternError, translateGlob } from './matching.ts'

const URL = 'https://api.example.com/graphql'

test('includes matches any substring, which is the loose default', () => {
  expect(matchUrl(URL, '/graphql')).toBe(true)
  expect(matchUrl('https://api.example.com/graphql/v2/other', '/graphql')).toBe(true)
  expect(matchUrl(URL, '/rest')).toBe(false)
})

test('glob anchors the whole URL, so a bare path does not match', () => {
  expect(matchUrl(URL, '/graphql', 'glob')).toBe(false)
  expect(matchUrl(URL, '*/graphql', 'glob')).toBe(true)
  expect(matchUrl('https://api.example.com/graphql/v2', '*/graphql', 'glob')).toBe(false)
  expect(matchUrl(URL, 'https://*.example.com/graphql', 'glob')).toBe(true)
})

test('glob supports ? and character classes', () => {
  expect(matchUrl('https://api1.example.com/graphql', '*api?.example.com/graphql', 'glob')).toBe(
    true,
  )
  expect(matchUrl('https://api1.example.com/graphql', '*api[0-9].example.com/*', 'glob')).toBe(true)
  expect(matchUrl('https://apix.example.com/graphql', '*api[!0-9].example.com/*', 'glob')).toBe(
    true,
  )
  expect(matchUrl('https://api1.example.com/graphql', '*api[!0-9].example.com/*', 'glob')).toBe(
    false,
  )
})

test('translateGlob escapes regex metacharacters in the literal parts', () => {
  expect(new RegExp(translateGlob('a.b')).test('a.b')).toBe(true)
  expect(new RegExp(translateGlob('a.b')).test('axb')).toBe(false)
})

test('regex matches partially, like re.search', () => {
  expect(matchUrl(URL, 'graphql$', 'regex')).toBe(true)
  expect(matchUrl('https://api.example.com/graphql/v2', 'graphql$', 'regex')).toBe(false)
  expect(matchUrl(URL, 'api\\.example\\.com', 'regex')).toBe(true)
})

test('exact compares the full URL', () => {
  expect(matchUrl(URL, URL, 'exact')).toBe(true)
  expect(matchUrl(`${URL}?x=1`, URL, 'exact')).toBe(false)
})

test('an uncompilable pattern never matches instead of throwing', () => {
  expect(() => matchUrl(URL, '[unclosed', 'regex')).not.toThrow()
  expect(matchUrl(URL, '[unclosed', 'regex')).toBe(false)
})

test('patternError reports what the editor should block on', () => {
  expect(patternError('', 'includes')).toBe('Required.')
  expect(patternError('*/graphql', 'glob')).toBeNull()
  expect(patternError('graphql$', 'regex')).toBeNull()
  expect(patternError('[unclosed', 'regex')).not.toBeNull()
})
