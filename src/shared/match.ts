import { identifyOperation, parseGraphQLRequest } from './graphql.ts'
import { matchUrl } from './matching.ts'
import { isSubset } from './object.ts'
import { createPersistedQueryCache, type PersistedQueryCache } from './persisted.ts'
import type { Rule } from './rule.types.ts'

// A persisted query sends a hash instead of its document, so naming one depends
// on what earlier requests taught the cache. The caller owns it — the
// interceptor keeps one for the life of the page — and a caller with no
// persisted queries to worry about can leave it out.
export function matchRule(
  rules: Rule[],
  url: string,
  body: unknown,
  cache: PersistedQueryCache = createPersistedQueryCache(),
): Rule | undefined {
  const request = parseGraphQLRequest(body)

  if (!request) {
    return undefined
  }

  const operationName = identifyOperation(request, cache)

  return rules.find((rule) => {
    if (!rule.enabled) {
      return false
    }

    if (!matchUrl(url, rule.endpoint, rule.matcher)) {
      return false
    }

    // An empty operationName is the wildcard: it takes the whole endpoint. A
    // persisted query whose hash is not yet known has no name either, so it
    // only ever matches that wildcard.
    if (rule.operationName && rule.operationName !== operationName) {
      return false
    }

    if (rule.matchVariables && !isSubset(request.variables, rule.matchVariables)) {
      return false
    }

    return true
  })
}
