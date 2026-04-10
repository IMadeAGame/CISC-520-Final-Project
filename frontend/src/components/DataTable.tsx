export default function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows || rows.length === 0) return null
  const columns = Object.keys(rows[0])

  return (
    <div style={{ margin: '10px 0', overflowX: 'auto', borderRadius: 8, border: '1px solid #2a2a3a' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#1a1a2e' }}>
            {columns.map(col => (
              <th key={col} style={{
                padding: '6px 10px', textAlign: 'left', color: '#93c5fd',
                fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #2a2a3a',
              }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#0f0f18' : '#13131e' }}>
              {columns.map(col => (
                <td key={col} style={{
                  padding: '5px 10px', color: '#d1d5db',
                  whiteSpace: 'nowrap', borderBottom: '1px solid #1f1f2e',
                }}>
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
