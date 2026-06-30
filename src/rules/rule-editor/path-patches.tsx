export interface PathPatchRow {
  path: string
  valueText: string
}

export interface PathPatchesProps {
  rows: PathPatchRow[]
  onChange: (rows: PathPatchRow[]) => void
}

export function PathPatches({ rows, onChange }: PathPatchesProps): React.JSX.Element {
  function update(index: number, patch: Partial<PathPatchRow>): void {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function add(): void {
    onChange([...rows, { path: '', valueText: '""' }])
  }

  function remove(index: number): void {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="path-patches">
      <span className="path-patches-title">
        patches (e.g. <code>appointments[].status</code> → value)
      </span>

      {rows.map((row, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="path-patch-row" key={index}>
          <input
            className="path-input"
            value={row.path}
            onChange={(event) => update(index, { path: event.target.value })}
            placeholder="data.items[].status"
          />
          <input
            className="value-input"
            value={row.valueText}
            onChange={(event) => update(index, { valueText: event.target.value })}
            placeholder='"CONFIRMED"'
          />
          <button
            type="button"
            className="rule-delete"
            onClick={() => remove(index)}
            aria-label="Remove patch"
          >
            ✕
          </button>
        </div>
      ))}

      <button type="button" onClick={add}>
        Add patch
      </button>
    </div>
  )
}
