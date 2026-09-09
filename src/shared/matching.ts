export type MatcherName = 'includes' | 'glob' | 'regex' | 'exact'

export const MATCHER_NAMES: MatcherName[] = ['includes', 'glob', 'regex', 'exact']

export const DEFAULT_MATCHER: MatcherName = 'includes'

export function isMatcherName(value: unknown): value is MatcherName {
  return MATCHER_NAMES.includes(value as MatcherName)
}

const STAR = Symbol('star')

type Token = string | typeof STAR

function escapeChar(char: string): string {
  return /[\\^$.*+?()[\]{}|/]/.test(char) ? `\\${char}` : char
}

// fnmatch semantics, matching pproxy so a rules file behaves the same in both:
// `*` spans any run of characters, `?` spans exactly one, `[seq]` / `[!seq]`
// are character classes. The whole URL must match.
export function translateGlob(pattern: string): string {
  const tokens: Token[] = []
  let i = 0

  while (i < pattern.length) {
    const char = pattern[i]

    i += 1

    if (char === '*') {
      if (tokens[tokens.length - 1] !== STAR) {
        tokens.push(STAR)
      }

      continue
    }

    if (char === '?') {
      tokens.push('.')
      continue
    }

    if (char !== '[') {
      tokens.push(escapeChar(char))
      continue
    }

    let j = i

    if (pattern[j] === '!') {
      j += 1
    }

    if (pattern[j] === ']') {
      j += 1
    }

    while (j < pattern.length && pattern[j] !== ']') {
      j += 1
    }

    if (j >= pattern.length) {
      // Unterminated class: the bracket is a literal.
      tokens.push('\\[')
      continue
    }

    let stuff = pattern.slice(i, j).replace(/\\/g, '\\\\')

    i = j + 1

    if (stuff === '') {
      tokens.push('(?!)')
    } else if (stuff === '!') {
      tokens.push('.')
    } else {
      if (stuff.startsWith('!')) {
        stuff = `^${stuff.slice(1)}`
      } else if (stuff.startsWith('^') || stuff.startsWith('[')) {
        stuff = `\\${stuff}`
      }

      tokens.push(`[${stuff}]`)
    }
  }

  return `^${tokens.map((token) => (token === STAR ? '.*' : token)).join('')}$`
}

function build(pattern: string, matcher: MatcherName): RegExp {
  return new RegExp(matcher === 'glob' ? translateGlob(pattern) : pattern, 's')
}

// Patterns come from stored rules and are reused for the life of the page, so
// the cache is unbounded on purpose. `null` marks a pattern that never
// compiles, which must not throw inside the interceptor.
const cache = new Map<string, RegExp | null>()

function compile(pattern: string, matcher: MatcherName): RegExp | null {
  const key = `${matcher}:${pattern}`

  if (!cache.has(key)) {
    try {
      cache.set(key, build(pattern, matcher))
    } catch {
      cache.set(key, null)
    }
  }

  return cache.get(key) ?? null
}

export function matchUrl(
  url: string,
  pattern: string,
  matcher: MatcherName = DEFAULT_MATCHER,
): boolean {
  if (matcher === 'exact') {
    return url === pattern
  }

  if (matcher === 'includes') {
    return url.includes(pattern)
  }

  return compile(pattern, matcher)?.test(url) ?? false
}

export function patternError(pattern: string, matcher: MatcherName): string | null {
  if (pattern === '') {
    return 'Required.'
  }

  if (matcher === 'includes' || matcher === 'exact') {
    return null
  }

  try {
    build(pattern, matcher)
  } catch (error) {
    return (error as Error).message
  }

  return null
}
