export function stringifyJson(value: unknown): string {
  if (value === undefined) {
    return ''
  }

  return JSON.stringify(value, null, 2)
}

export type JsonParse = { ok: true; value: unknown } | { ok: false; error: string }

export function parseJson(text: string, allowEmpty: boolean): JsonParse {
  const trimmed = text.trim()

  if (trimmed === '') {
    if (allowEmpty) {
      return { ok: true, value: undefined }
    }

    return { ok: false, error: 'Required.' }
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export type NumberParse = { ok: true; value: number | undefined } | { ok: false; error: string }

export function parseIntegerField(text: string, min: number, max: number): NumberParse {
  const trimmed = text.trim()

  if (trimmed === '') {
    return { ok: true, value: undefined }
  }

  const value = Number(trimmed)

  if (!Number.isInteger(value) || value < min || value > max) {
    return { ok: false, error: `Expected an integer between ${min} and ${max}.` }
  }

  return { ok: true, value }
}

export type HeadersParse =
  | { ok: true; value: Record<string, string> | undefined }
  | { ok: false; error: string }

export function parseHeaders(text: string): HeadersParse {
  const parsed = parseJson(text, true)

  if (!parsed.ok) {
    return parsed
  }

  if (parsed.value === undefined) {
    return { ok: true, value: undefined }
  }

  const value = parsed.value

  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !Object.values(value).every((header) => typeof header === 'string')
  ) {
    return { ok: false, error: 'Expected an object of string values.' }
  }

  return { ok: true, value: value as Record<string, string> }
}
