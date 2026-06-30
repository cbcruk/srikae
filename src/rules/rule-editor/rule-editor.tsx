import { useState } from 'react'

import { parsePath } from '../../shared/path.ts'
import type { PathPatch, Rule, RuleAction } from '../../shared/rule.types.ts'
import { PathPatches, type PathPatchRow } from './path-patches.tsx'
import { parseJson, stringifyJson } from './rule-editor.utils.ts'

export interface RuleEditorProps {
  rule: Rule
  onSave: (rule: Rule) => void
  onCancel: () => void
}

export function RuleEditor({ rule, onSave, onCancel }: RuleEditorProps): React.JSX.Element {
  const [endpoint, setEndpoint] = useState(rule.endpoint)
  const [operationName, setOperationName] = useState(rule.operationName)
  const [actionType, setActionType] = useState<RuleAction['type']>(rule.action.type)
  const [matchVariablesText, setMatchVariablesText] = useState(stringifyJson(rule.matchVariables))
  const [dataText, setDataText] = useState(
    rule.action.type === 'mock' ? stringifyJson(rule.action.data) : '{}',
  )
  const [errorsText, setErrorsText] = useState(
    rule.action.type === 'mock' ? stringifyJson(rule.action.errors) : '',
  )
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

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()

    if (operationName.trim() === '') {
      setError('operationName is required.')

      return
    }

    const matchVariables = parseJson(matchVariablesText, true)

    if (!matchVariables.ok) {
      setError(`matchVariables: ${matchVariables.error}`)

      return
    }

    let action: RuleAction

    if (actionType === 'mock') {
      const data = parseJson(dataText, false)

      if (!data.ok) {
        setError(`data: ${data.error}`)

        return
      }

      const errors = parseJson(errorsText, true)

      if (!errors.ok) {
        setError(`errors: ${errors.error}`)

        return
      }

      action = {
        type: 'mock',
        data: data.value,
        errors: errors.value as unknown[] | undefined,
      }
    } else if (actionType === 'modify') {
      const mergePatch = parseJson(mergePatchText, false)

      if (!mergePatch.ok) {
        setError(`mergePatch: ${mergePatch.error}`)

        return
      }

      action = { type: 'modify', mergePatch: mergePatch.value }
    } else {
      const patches: PathPatch[] = []

      for (const [index, row] of patchRows.entries()) {
        const path = row.path.trim()

        if (path === '') {
          setError(`patch ${index + 1}: path is required.`)

          return
        }

        try {
          parsePath(path)
        } catch (pathError) {
          setError(`patch ${index + 1} path: ${(pathError as Error).message}`)

          return
        }

        const value = parseJson(row.valueText, false)

        if (!value.ok) {
          setError(`patch ${index + 1} value: ${value.error}`)

          return
        }

        patches.push({ path, value: value.value })
      }

      if (patches.length === 0) {
        setError('Add at least one patch.')

        return
      }

      action = { type: 'path', patches }
    }

    onSave({
      ...rule,
      endpoint: endpoint.trim(),
      operationName: operationName.trim(),
      matchVariables: matchVariables.value as Record<string, unknown> | undefined,
      action,
    })
  }

  return (
    <form className="rule-editor" onSubmit={handleSubmit}>
      <label>
        Endpoint (substring)
        <input
          value={endpoint}
          onChange={(event) => setEndpoint(event.target.value)}
          placeholder="/graphql"
        />
      </label>

      <label>
        operationName
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
