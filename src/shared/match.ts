import { isPlainObject, isSubset } from './object.ts'
import type { GraphQLRequestBody, Rule } from './rule.types.ts'

export function matchRule(rules: Rule[], url: string, body: unknown): Rule | undefined {
  if (!isPlainObject(body)) {
    return undefined
  }

  const { operationName, variables } = body as GraphQLRequestBody

  if (!operationName) {
    return undefined
  }

  return rules.find((rule) => {
    if (!rule.enabled) {
      return false
    }

    if (!url.includes(rule.endpoint)) {
      return false
    }

    if (rule.operationName !== operationName) {
      return false
    }

    if (rule.matchVariables && !isSubset(variables, rule.matchVariables)) {
      return false
    }

    return true
  })
}
