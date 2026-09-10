// Adapter for pproxy's rules file. pproxy is the proxy runtime that solves the
// same matching problem outside the browser, so a rule tuned here can be run
// against a phone or handed to a teammate without retyping it.
//
// The two formats are kept separate on purpose. pproxy's is snake_case because
// it is also read by an archived Python implementation; srikae's carries an id
// and an enabled flag that only a UI needs. This file converts, and says what
// it could not carry across rather than guessing.

import { isMatcherName } from './matching.ts'
import { isPlainObject } from './object.ts'
import type { MockAction, PathPatch, Rule, RuleAction } from './rule.types.ts'

export interface PproxyGraphQL {
  operation_name?: string
  variables?: Record<string, unknown>
}

export interface PproxyRule {
  name?: string
  url_pattern: string
  matcher?: string
  graphql?: PproxyGraphQL | null
  status_code?: number
  headers?: Record<string, string>
  delay_ms?: number
  body?: unknown
  merge_patch?: unknown
  patches?: PathPatch[]
}

export interface SkippedRule {
  pattern: string
  reason: string
}

export interface PproxyImport {
  rules: Rule[]
  skipped: SkippedRule[]
}

// pproxy has no `includes` matcher, so a substring endpoint becomes the glob
// that means the same. fnmatch has no backslash escape, so its own
// metacharacters are wrapped as one-character classes instead — `[*]` matches a
// literal star.
function includesToGlob(pattern: string): string {
  return `*${pattern.replace(/[*?[]/g, (char) => `[${char}]`)}*`
}

function toPproxyAction(action: RuleAction): Partial<PproxyRule> {
  if (action.type === 'modify') {
    return { merge_patch: action.mergePatch }
  }

  if (action.type === 'path') {
    return { patches: action.patches }
  }

  const mock: Partial<PproxyRule> = {}

  if (action.status !== undefined) {
    mock.status_code = action.status
  }

  if (action.headers && Object.keys(action.headers).length > 0) {
    mock.headers = action.headers
  }

  if (action.delayMs) {
    mock.delay_ms = action.delayMs
  }

  mock.body =
    action.body !== undefined
      ? action.body
      : action.errors
        ? { data: action.data, errors: action.errors }
        : { data: action.data }

  return mock
}

function toPproxyRule(rule: Rule): PproxyRule {
  const matcher = rule.matcher ?? 'includes'
  const graphql: PproxyGraphQL = {}

  if (rule.operationName) {
    graphql.operation_name = rule.operationName
  }

  if (rule.matchVariables && Object.keys(rule.matchVariables).length > 0) {
    graphql.variables = rule.matchVariables
  }

  const converted: PproxyRule = {
    url_pattern: matcher === 'includes' ? includesToGlob(rule.endpoint) : rule.endpoint,
    // The `graphql` block is what keeps a pproxy rule from swallowing REST
    // traffic on the same URL, so it is written even when it is empty.
    graphql,
    ...toPproxyAction(rule.action),
  }

  if (matcher !== 'includes') {
    converted.matcher = matcher
  }

  // pproxy prints this in `check` output and in its verbose log, and the
  // operation is the only name a rule here has.
  if (rule.operationName) {
    converted.name = rule.operationName
  }

  return converted
}

// Disabled rules are left out. A pproxy rules file has no way to carry one, and
// exporting it as active would turn a rule off here into a rule on there.
export function toPproxyRules(rules: Rule[]): PproxyRule[] {
  return rules.filter((rule) => rule.enabled).map(toPproxyRule)
}

function toMockAction(rule: PproxyRule): MockAction {
  const body = 'body' in rule ? rule.body : {}
  const action: MockAction = { type: 'mock', data: {} }

  if (rule.status_code !== undefined) {
    action.status = rule.status_code
  }

  if (rule.headers) {
    action.headers = rule.headers
  }

  if (rule.delay_ms) {
    action.delayMs = rule.delay_ms
  }

  if (isPlainObject(body) && 'data' in body && Object.keys(body).every(isEnvelopeKey)) {
    action.data = body.data

    if (Array.isArray(body.errors)) {
      action.errors = body.errors
    }

    return action
  }

  action.body = body

  return action
}

// The keys a response envelope may have for the editor to show it as data and
// errors. A body with anything else in it is kept whole.
function isEnvelopeKey(key: string): boolean {
  return key === 'data' || key === 'errors'
}

// pproxy's graphql block, read defensively — a rules file is hand-written.
function toCondition(value: unknown): Pick<Rule, 'operationName' | 'matchVariables'> {
  const block = isPlainObject(value) ? value : {}
  const name = block.operation_name

  return {
    operationName: typeof name === 'string' ? name : '',
    ...(isPlainObject(block.variables) ? { matchVariables: block.variables } : {}),
  }
}

function toRuleAction(rule: PproxyRule): RuleAction {
  if (rule.merge_patch !== undefined && rule.merge_patch !== null) {
    return { type: 'modify', mergePatch: rule.merge_patch }
  }

  if (rule.patches && rule.patches.length > 0) {
    return { type: 'path', patches: rule.patches }
  }

  return toMockAction(rule)
}

// Returns the reason a rule cannot be represented here, or null when it can.
function unsupported(rule: PproxyRule): string | null {
  if (typeof rule.url_pattern !== 'string' || rule.url_pattern === '') {
    return 'no url_pattern'
  }

  if (!isPlainObject(rule.graphql)) {
    return 'not a GraphQL rule'
  }

  if (rule.matcher !== undefined && !isMatcherName(rule.matcher)) {
    return `unknown matcher "${rule.matcher}"`
  }

  const hasMerge = rule.merge_patch !== undefined && rule.merge_patch !== null
  const hasPatches = Boolean(rule.patches && rule.patches.length > 0)

  if (hasMerge && hasPatches) {
    // pproxy applies both in one rule; an action here is one or the other.
    return 'combines merge_patch and patches'
  }

  return null
}

// Reads a pproxy rules file. Rules it cannot represent are reported rather than
// dropped silently, since a rule that quietly vanished is worse than one that
// never arrived.
export function fromPproxyRules(value: unknown): PproxyImport {
  if (!Array.isArray(value)) {
    throw new Error('Invalid pproxy rules file: expected an array of rules.')
  }

  const rules: Rule[] = []
  const skipped: SkippedRule[] = []

  for (const entry of value) {
    const rule = entry as PproxyRule
    const pattern = typeof rule?.url_pattern === 'string' ? rule.url_pattern : '(unnamed)'
    const reason = isPlainObject(entry) ? unsupported(rule) : 'not a rule'

    if (reason) {
      skipped.push({ pattern, reason })
      continue
    }

    rules.push({
      id: crypto.randomUUID(),
      enabled: true,
      endpoint: rule.url_pattern,
      // pproxy's default is glob, not the substring match this panel defaults to.
      matcher: isMatcherName(rule.matcher) ? rule.matcher : 'glob',
      ...toCondition(rule.graphql),
      action: toRuleAction(rule),
    })
  }

  return { rules, skipped }
}

// True for something shaped like a pproxy rules file, so one Import button can
// take either format. The two are disjoint: a rule here has an id and an
// endpoint, a pproxy rule has a url_pattern.
export function looksLikePproxyRules(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((entry) => isPlainObject(entry) && typeof entry.url_pattern === 'string')
  )
}
