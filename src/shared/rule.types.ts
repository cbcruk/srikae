import type { MatcherName } from './matching.ts'

export interface MockAction {
  type: 'mock'
  data: unknown
  errors?: unknown[]
  // Replaces the whole response body when set, for servers whose envelope is
  // not `{data, errors}`. `data` and `errors` are ignored then.
  body?: unknown
  status?: number
  headers?: Record<string, string>
  delayMs?: number
}

export interface ModifyAction {
  type: 'modify'
  mergePatch: unknown
}

export interface PathPatch {
  path: string
  value: unknown
}

export interface PathAction {
  type: 'path'
  patches: PathPatch[]
}

export type RuleAction = MockAction | ModifyAction | PathAction

export interface Rule {
  id: string
  enabled: boolean
  endpoint: string
  matcher?: MatcherName
  // Empty matches every operation on the endpoint.
  operationName: string
  matchVariables?: Record<string, unknown>
  action: RuleAction
}

export interface GraphQLRequestBody {
  operationName?: string
  query?: string
  variables?: Record<string, unknown>
}
