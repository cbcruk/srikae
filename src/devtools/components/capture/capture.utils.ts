import { isPlainObject } from '../../../shared/object.ts'
import type { GraphQLRequestBody, Rule } from '../../../shared/rule.types.ts'
import type { CapturedOperation, CapturedRequest } from './capture.types.ts'

export function parseGraphQLBody(text: string | undefined): CapturedOperation | null {
  if (!text) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  // Batch arrays and non-object bodies are out of scope (passthrough).
  if (!isPlainObject(parsed)) {
    return null
  }

  const { operationName, variables } = parsed as GraphQLRequestBody

  if (typeof operationName !== 'string' || operationName === '') {
    return null
  }

  return { operationName, variables }
}

export function deriveEndpoint(url: string): string {
  try {
    const parsed = new URL(url)

    return parsed.pathname !== '/' ? parsed.pathname : parsed.host
  } catch {
    return url
  }
}

export function dataFromResponseText(text: string): unknown {
  try {
    const parsed = JSON.parse(text)

    return isPlainObject(parsed) && 'data' in parsed ? parsed.data : parsed
  } catch {
    return {}
  }
}

export function ruleFromCapture(capture: CapturedRequest, data: unknown = {}): Rule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    endpoint: deriveEndpoint(capture.url),
    operationName: capture.operationName,
    matchVariables: capture.variables,
    action: { type: 'mock', data },
  }
}
