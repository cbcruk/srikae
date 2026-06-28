export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isSubset(actual: unknown, expected: unknown): boolean {
  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      return false
    }

    return Object.entries(expected).every(([key, value]) => isSubset(actual[key], value))
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return false
    }

    return expected.every((value, index) => isSubset(actual[index], value))
  }

  return actual === expected
}

export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) {
    return patch
  }

  const result: Record<string, unknown> = isPlainObject(target) ? { ...target } : {}

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key]
    } else {
      result[key] = mergePatch(result[key], value)
    }
  }

  return result
}
