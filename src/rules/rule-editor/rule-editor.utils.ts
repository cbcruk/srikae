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
