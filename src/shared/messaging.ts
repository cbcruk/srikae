import type { Rule } from './rule.types.ts'

export const RULES_EVENT = 'gqlmock:rules'

export interface RulesEventDetail {
  rules: Rule[]
}
