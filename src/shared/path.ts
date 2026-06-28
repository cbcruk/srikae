import { isPlainObject } from './object.ts'
import type { PathPatch } from './rule.types.ts'

export type PathStep =
  | { type: 'key'; key: string }
  | { type: 'wildcard' }
  | { type: 'index'; index: number }

const SEGMENT = /^([^[\]]*)((?:\[[^\]]*\])*)$/
const BRACKET = /\[[^\]]*\]/g

export function parsePath(path: string): PathStep[] {
  const steps: PathStep[] = []

  for (const segment of path.split('.')) {
    const match = SEGMENT.exec(segment)

    if (!match) {
      throw new Error(`Invalid path segment: "${segment}"`)
    }

    const [, key, brackets] = match

    if (key) {
      steps.push({ type: 'key', key })
    }

    for (const group of brackets.match(BRACKET) ?? []) {
      const inner = group.slice(1, -1).trim()

      if (inner === '') {
        steps.push({ type: 'wildcard' })
        continue
      }

      const index = Number(inner)

      if (!Number.isInteger(index) || index < 0) {
        throw new Error(`Invalid array index: "${group}"`)
      }

      steps.push({ type: 'index', index })
    }
  }

  if (steps.length === 0) {
    throw new Error('Empty path')
  }

  return steps
}

function applySteps(node: unknown, steps: PathStep[], value: unknown): void {
  if (node === null || node === undefined) {
    return
  }

  const [step, ...rest] = steps
  const last = rest.length === 0

  if (step.type === 'wildcard') {
    if (!Array.isArray(node)) {
      return
    }

    node.forEach((element, index) => {
      if (last) {
        node[index] = value
      } else {
        applySteps(element, rest, value)
      }
    })

    return
  }

  if (step.type === 'index') {
    if (!Array.isArray(node) || step.index >= node.length) {
      return
    }

    if (last) {
      node[step.index] = value
    } else {
      applySteps(node[step.index], rest, value)
    }

    return
  }

  if (!isPlainObject(node)) {
    return
  }

  if (last) {
    node[step.key] = value
  } else {
    applySteps(node[step.key], rest, value)
  }
}

export function applyPathPatches(response: unknown, patches: PathPatch[]): unknown {
  const result = structuredClone(response)

  for (const { path, value } of patches) {
    applySteps(result, parsePath(path), value)
  }

  return result
}
