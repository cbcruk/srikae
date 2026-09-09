import { useState } from 'react'

import { MATCHER_NAMES, type MatcherName, patternError } from '../../shared/matching.ts'
import { parsePath } from '../../shared/path.ts'
import type { PathPatch, Rule, RuleAction } from '../../shared/rule.types.ts'
import { MAX_STATUS, MIN_STATUS } from '../../shared/rule.utils.ts'
import { PathPatches, type PathPatchRow } from './path-patches.tsx'
import { parseHeaders, parseIntegerField, parseJson, stringifyJson } from './rule-editor.utils.ts'

const MAX_DELAY_MS = 60_000

const ENDPOINT_PLACEHOLDER: Record<MatcherName, string> = {
  includes: '/graphql',
  glob: '*://api.example.com/graphql',
  regex: '/graphql$',
  exact: 'https://api.example.com/graphql',
}

export interface RuleEditorProps {
  rule: Rule
  onSave: (rule: Rule) => void
  onCancel: () => void
}

export function RuleEditor({ rule, onSave, onCancel }: RuleEditorProps): React.JSX.Element {
  const mock = rule.action.type === 'mock' ? rule.action : undefined
  const [endpoint, setEndpoint] = useState(rule.endpoint)
  const [matcher, setMatcher] = useState<MatcherName>(rule.matcher ?? 'includes')
  const [operationName, setOperationName] = useState(rule.operationName)
  const [actionType, setActionType] = useState<RuleAction['type']>(rule.action.type)
  const [matchVariablesText, setMatchVariablesText] = useState(stringifyJson(rule.matchVariables))
  const [envelope, setEnvelope] = useState(mock?.body === undefined)
  const [dataText, setDataText] = useState(
    mock?.data === undefined ? '{}' : stringifyJson(mock.data),
  )
  const [errorsText, setErrorsText] = useState(stringifyJson(mock?.errors))
  const [bodyText, setBodyText] = useState(
    mock?.body === undefined ? '{}' : stringifyJson(mock.body),
  )
  const [statusText, setStatusText] = useState(mock?.status?.toString() ?? '')
  const [headersText, setHeadersText] = useState(stringifyJson(mock?.headers))
  const [delayText, setDelayText] = useState(mock?.delayMs?.toString() ?? '')
  const [mergePatchText, setMergePatchText] = useState(
    rule.action.type === 'modify' ? stringifyJson(rule.action.mergePatch) : '{}',
  )
  const [patchRows, setPatchRows] = useState<PathPatchRow[]>(
    rule.action.type === 'path'
      ? rule.action.patches.map((patch) => ({
          path: patch.path,
          valueText: stringifyJson(patch.value),
        }))
      : [{ path: '', valueText: '""' }],
  )
  const [error, setError] = useState<string | null>(null)

  function buildMockAction(): RuleAction | string {
    const status = parseIntegerField(statusText, MIN_STATUS, MAX_STATUS)

    if (!status.ok) {
      return `status: ${status.error}`
    }

    const delayMs = parseIntegerField(delayText, 0, MAX_DELAY_MS)

    if (!delayMs.ok) {
      return `delayMs: ${delayMs.error}`
    }

    const headers = parseHeaders(headersText)

    if (!headers.ok) {
      return `headers: ${headers.error}`
    }

    const response = { status: status.value, headers: headers.value, delayMs: delayMs.value }

    if (!envelope) {
      const body = parseJson(bodyText, false)

      if (!body.ok) {
        return `body: ${body.error}`
      }

      return { type: 'mock', data: undefined, body: body.value, ...response }
    }

    const data = parseJson(dataText, false)

    if (!data.ok) {
      return `data: ${data.error}`
    }

    const errors = parseJson(errorsText, true)

    if (!errors.ok) {
      return `errors: ${errors.error}`
    }

    return {
      type: 'mock',
      data: data.value,
      errors: errors.value as unknown[] | undefined,
      ...response,
    }
  }

  function buildPathAction(): RuleAction | string {
    const patches: PathPatch[] = []

    for (const [index, row] of patchRows.entries()) {
      const path = row.path.trim()

      if (path === '') {
        return `patch ${index + 1}: path is required.`
      }

      try {
        parsePath(path)
      } catch (pathError) {
        return `patch ${index + 1} path: ${(pathError as Error).message}`
      }

      const value = parseJson(row.valueText, false)

      if (!value.ok) {
        return `patch ${index + 1} value: ${value.error}`
      }

      patches.push({ path, value: value.value })
    }

    if (patches.length === 0) {
      return 'Add at least one patch.'
    }

    return { type: 'path', patches }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()

    const trimmedEndpoint = endpoint.trim()
    const endpointError = patternError(trimmedEndpoint, matcher)

    if (endpointError) {
      setError(`endpoint: ${endpointError}`)

      return
    }

    const matchVariables = parseJson(matchVariablesText, true)

    if (!matchVariables.ok) {
      setError(`matchVariables: ${matchVariables.error}`)

      return
    }

    let action: RuleAction | string

    if (actionType === 'mock') {
      action = buildMockAction()
    } else if (actionType === 'modify') {
      const mergePatch = parseJson(mergePatchText, false)

      action = mergePatch.ok
        ? { type: 'modify', mergePatch: mergePatch.value }
        : `mergePatch: ${mergePatch.error}`
    } else {
      action = buildPathAction()
    }

    if (typeof action === 'string') {
      setError(action)

      return
    }

    onSave({
      ...rule,
      endpoint: trimmedEndpoint,
      matcher,
      operationName: operationName.trim(),
      matchVariables: matchVariables.value as Record<string, unknown> | undefined,
      action,
    })
  }

  return (
    <form className="rule-editor" onSubmit={handleSubmit}>
      <div className="field-row">
        <label>
          Endpoint
          <input
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder={ENDPOINT_PLACEHOLDER[matcher]}
          />
        </label>
        <label>
          Matcher
          <select
            value={matcher}
            onChange={(event) => setMatcher(event.target.value as MatcherName)}
          >
            {MATCHER_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        operationName (empty matches every operation)
        <input
          value={operationName}
          onChange={(event) => setOperationName(event.target.value)}
          placeholder="GetUser"
        />
      </label>

      <label>
        matchVariables (optional, deep subset)
        <textarea
          value={matchVariablesText}
          onChange={(event) => setMatchVariablesText(event.target.value)}
          rows={3}
          placeholder="{}"
        />
      </label>

      <fieldset className="action-type">
        <legend>Action</legend>
        <label>
          <input
            type="radio"
            name="actionType"
            checked={actionType === 'mock'}
            onChange={() => setActionType('mock')}
          />
          mock (replace body)
        </label>
        <label>
          <input
            type="radio"
            name="actionType"
            checked={actionType === 'modify'}
            onChange={() => setActionType('modify')}
          />
          modify (merge-patch)
        </label>
        <label>
          <input
            type="radio"
            name="actionType"
            checked={actionType === 'path'}
            onChange={() => setActionType('path')}
          />
          path (array transform)
        </label>
      </fieldset>

      {actionType === 'mock' ? (
        <>
          <fieldset className="action-type">
            <legend>Body</legend>
            <label>
              <input
                type="radio"
                name="envelope"
                checked={envelope}
                onChange={() => setEnvelope(true)}
              />
              {'{ data, errors }'}
            </label>
            <label>
              <input
                type="radio"
                name="envelope"
                checked={!envelope}
                onChange={() => setEnvelope(false)}
              />
              raw body
            </label>
          </fieldset>

          {envelope ? (
            <>
              <label>
                data
                <textarea
                  value={dataText}
                  onChange={(event) => setDataText(event.target.value)}
                  rows={6}
                />
              </label>
              <label>
                errors (optional)
                <textarea
                  value={errorsText}
                  onChange={(event) => setErrorsText(event.target.value)}
                  rows={3}
                />
              </label>
            </>
          ) : (
            <label>
              body (sent as-is, envelope included)
              <textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                rows={8}
              />
            </label>
          )}

          <div className="field-row">
            <label>
              status (default 200)
              <input
                value={statusText}
                onChange={(event) => setStatusText(event.target.value)}
                inputMode="numeric"
                placeholder="200"
              />
            </label>
            <label>
              delayMs (default 0)
              <input
                value={delayText}
                onChange={(event) => setDelayText(event.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </label>
          </div>

          <label>
            headers (optional, overrides content-type)
            <textarea
              value={headersText}
              onChange={(event) => setHeadersText(event.target.value)}
              rows={3}
              placeholder='{ "x-mocked": "1" }'
            />
          </label>
        </>
      ) : actionType === 'modify' ? (
        <label>
          mergePatch (RFC 7386, null deletes a key)
          <textarea
            value={mergePatchText}
            onChange={(event) => setMergePatchText(event.target.value)}
            rows={6}
          />
        </label>
      ) : (
        <PathPatches rows={patchRows} onChange={setPatchRows} />
      )}

      {error ? <p className="error">{error}</p> : null}

      <div className="editor-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
