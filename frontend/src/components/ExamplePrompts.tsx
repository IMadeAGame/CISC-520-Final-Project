const EXAMPLES = [
  {
    label: 'Stock Analysis',
    desc: 'AAPL last 100 days — line chart + statistics',
    prompt: 'Fetch the last 100 days of Apple (AAPL) stock closing prices. Plot a line chart with dates on the x-axis. Then calculate and display: mean, median, standard deviation, min, and max price.',
  },
  {
    label: 'CSV Analysis',
    desc: 'Upload a CSV — rows, types, missing values, histogram',
    prompt: 'Analyze the uploaded CSV dataset. Show me the first 5 rows as a table, data types for each column, any missing values, and a histogram of the first numeric column.',
  },
  {
    label: 'Statistical Comparison',
    desc: 'TSLA vs MSFT monthly returns + t-test',
    prompt: 'Compare the monthly returns of Tesla (TSLA) and Microsoft (MSFT) over the past year. Show both on the same chart and run a t-test to determine if the mean returns are significantly different.',
  },
]

export default function ExamplePrompts({ onSelect }: { onSelect: (p: string) => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, gap: 32, padding: '0 20px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
          Data Analysis AI
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          Describe what you want to analyze in plain English
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 720, width: '100%' }}>
        {EXAMPLES.map(ex => (
          <button
            key={ex.label}
            onClick={() => onSelect(ex.prompt)}
            style={{
              display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px',
              background: '#0f0f18', border: '1px solid #2a2a3a', borderRadius: 12,
              textAlign: 'left', transition: 'all 0.2s', cursor: 'pointer',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#3b5bdb'
              ;(e.currentTarget as HTMLElement).style.background = '#13131e'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = '#2a2a3a'
              ;(e.currentTarget as HTMLElement).style.background = '#0f0f18'
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>{ex.label}</span>
            <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{ex.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
