import { parseGraphQLRequest } from '../../../shared/graphql.ts'
import { isPlainObject } from '../../../shared/object.ts'
import type { Rule } from '../../../shared/rule.types.ts'
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

  const request = parseGraphQLRequest(parsed)

  // Batch arrays and non-GraphQL bodies are out of scope, and a capture only
  // seeds a rule once it has a name to show.
  return request?.operationName ? request : null
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
    matcher: 'includes',
    operationName: capture.operationName,
    matchVariables: capture.variables,
    action: { type: 'mock', data },
  }
}
