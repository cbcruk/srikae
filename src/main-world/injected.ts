import { BatchInterceptor } from '@mswjs/interceptors'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'

import { matchRule } from '../shared/match.ts'
import { RULES_EVENT, type RulesEventDetail } from '../shared/messaging.ts'
import { mergePatch } from '../shared/object.ts'
import { applyPathPatches } from '../shared/path.ts'
import type { Rule } from '../shared/rule.types.ts'

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
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
    controller.respondWith(jsonResponse({ data: rule.action.data, errors: rule.action.errors }))

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
