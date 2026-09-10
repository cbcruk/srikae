import { isPlainObject } from './object.ts'
import type { PersistedQueryCache } from './persisted.ts'
import type { GraphQLRequestBody } from './rule.types.ts'

// Many clients omit `operationName` for single-operation documents, so the name
// is recovered from the document text instead of giving up on the match.
const OPERATION_NAME = /\b(?:query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)/

export interface GraphQLRequest {
  operationName: string
  variables?: Record<string, unknown>
  // The Automatic Persisted Queries hash, when the client sent one. Present
  // alongside the document on the request that registers it, and alone on every
  // request after that.
  persistedQueryHash?: string
}

// Reads `extensions.persistedQuery.sha256Hash`. The APQ version field is
// ignored: a hash identifies a document whatever the protocol revision.
function readPersistedQueryHash(body: Record<string, unknown>): string | undefined {
  const { extensions } = body

  if (!isPlainObject(extensions) || !isPlainObject(extensions.persistedQuery)) {
    return undefined
  }

  const hash = extensions.persistedQuery.sha256Hash

  return typeof hash === 'string' && hash !== '' ? hash : undefined
}

export function extractOperationName(query: string): string {
  return OPERATION_NAME.exec(query)?.[1] ?? ''
}

// Returns null for anything that is not a single GraphQL request: batch arrays,
// and plain POST bodies carrying none of the three things that mark one — a
// document, an operation name, or a persisted query hash. Those stay
// passthrough, so an endpoint-wide rule cannot swallow a REST call.
export function parseGraphQLRequest(body: unknown): GraphQLRequest | null {
  if (!isPlainObject(body)) {
    return null
  }

  const { operationName, query, variables } = body as GraphQLRequestBody
  const hasQuery = typeof query === 'string' && query.trim() !== ''
  const persistedQueryHash = readPersistedQueryHash(body)

  if (!hasQuery && !operationName && !persistedQueryHash) {
    return null
  }

  return {
    operationName: operationName || (hasQuery ? extractOperationName(query) : ''),
    variables: isPlainObject(variables) ? variables : undefined,
    ...(persistedQueryHash ? { persistedQueryHash } : {}),
  }
}

// Names a request, learning from it when it can. A request that carries both a
// hash and a name teaches the cache; one that carries only a hash is named from
// what the cache already knows. Returns an empty name when neither works, which
// still matches an endpoint-wide rule.
export function identifyOperation(request: GraphQLRequest, cache: PersistedQueryCache): string {
  const { operationName, persistedQueryHash } = request

  if (!persistedQueryHash) {
    return operationName
  }

  if (operationName) {
    cache.remember(persistedQueryHash, operationName)

    return operationName
  }

  return cache.resolve(persistedQueryHash)
}
