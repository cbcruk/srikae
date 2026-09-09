import { BatchInterceptor } from '@mswjs/interceptors'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'

import { matchRule } from '../shared/match.ts'
import { RULES_EVENT, type RulesEventDetail } from '../shared/messaging.ts'
import { mergePatch } from '../shared/object.ts'
import { applyPathPatches } from '../shared/path.ts'
import type { MockAction, Rule } from '../shared/rule.types.ts'

// Trap 1: capture native fetch BEFORE interceptor.apply() so the `modify`
// path can reach the real server without re-intercepting itself.
const nativeFetch = window.fetch.bind(window)

let rules: Rule[] = []

// Trap 2: rules arrive asynchronously from the ISOLATED world. Hold matching
// until the first sync so early requests are not missed.
let markReady: () => void
const rulesReady = new Promise<void>((resolve) => {
  markReady = resolve
})

window.addEventListener(RULES_EVENT, (event) => {
  rules = (event as CustomEvent<RulesEventDetail>).detail.rules
  markReady()
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function mockResponse(action: MockAction): Response {
  const headers = new Headers({ 'content-type': 'application/json' })

  for (const [name, value] of Object.entries(action.headers ?? {})) {
    headers.set(name, value)
  }

  const body =
    action.body === undefined ? { data: action.data, errors: action.errors } : action.body

  return new Response(JSON.stringify(body), { status: action.status ?? 200, headers })
}

const interceptor = new BatchInterceptor({
  name: 'gqlmock',
  interceptors: [new FetchInterceptor(), new XMLHttpRequestInterceptor()],
})

interceptor.on('request', async ({ request, controller }) => {
  if (request.method !== 'POST') {
    return
  }

  await rulesReady

  let body: unknown

  try {
    body = await request.clone().json()
  } catch {
    return
  }

  const rule = matchRule(rules, request.url, body)

  if (!rule) {
    return
  }

  if (rule.action.type === 'mock') {
    if (rule.action.delayMs) {
      await sleep(rule.action.delayMs)
    }

    controller.respondWith(mockResponse(rule.action))

    return
  }

  // modify / path both transform the real response, fetched via nativeFetch
  // to avoid re-intercepting ourselves.
  const real = await nativeFetch(request.clone())
  const original = await real.json()
  const patched =
    rule.action.type === 'modify'
      ? mergePatch(original, rule.action.mergePatch)
      : applyPathPatches(original, rule.action.patches)

  controller.respondWith(jsonResponse(patched, real.status))
})

interceptor.apply()
