import { isPlainObject } from './object.ts'
import type { GraphQLRequestBody } from './rule.types.ts'

// Many clients omit `operationName` for single-operation documents, so the name
// is recovered from the document text instead of giving up on the match.
const OPERATION_NAME = /\b(?:query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)/

export interface GraphQLRequest {
  operationName: string
  variables?: Record<string, unknown>
}

export function extractOperationName(query: string): string {
  return OPERATION_NAME.exec(query)?.[1] ?? ''
}

// Returns null for anything that is not a single GraphQL request: batch arrays,
// and plain POST bodies that carry neither a document nor an operation name.
// Those stay passthrough, so an endpoint-wide rule cannot swallow a REST call.
export function parseGraphQLRequest(body: unknown): GraphQLRequest | null {
  if (!isPlainObject(body)) {
    return null
  }

  const { operationName, query, variables } = body as GraphQLRequestBody
  const hasQuery = typeof query === 'string' && query.trim() !== ''

  if (!hasQuery && !operationName) {
    return null
  }

  return {
    operationName: operationName || (hasQuery ? extractOperationName(query) : ''),
    variables: isPlainObject(variables) ? variables : undefined,
  }
}
