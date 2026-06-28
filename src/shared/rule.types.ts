export interface MockAction {
  type: 'mock'
  data: unknown
  errors?: unknown[]
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
  operationName: string
  matchVariables?: Record<string, unknown>
  action: RuleAction
}

export interface GraphQLRequestBody {
  operationName?: string
  query?: string
  variables?: Record<string, unknown>
}
