import { parseGraphQLRequest } from './graphql.ts'
import { matchUrl } from './matching.ts'
import { isSubset } from './object.ts'
import type { Rule } from './rule.types.ts'

export function matchRule(rules: Rule[], url: string, body: unknown): Rule | undefined {
  const request = parseGraphQLRequest(body)

  if (!request) {
    return undefined
  }

  return rules.find((rule) => {
    if (!rule.enabled) {
      return false
    }

    if (!matchUrl(url, rule.endpoint, rule.matcher)) {
      return false
    }

    // An empty operationName is the wildcard: it takes the whole endpoint.
    if (rule.operationName && rule.operationName !== request.operationName) {
      return false
    }

    if (rule.matchVariables && !isSubset(request.variables, rule.matchVariables)) {
      return false
    }

    return true
  })
}
