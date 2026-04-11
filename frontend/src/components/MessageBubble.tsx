import CodeBlock from './CodeBlock'
import ChartImage from './ChartImage'
import DataTable from './DataTable'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  codeBlocks?: string[]
  images?: string[]
  tables?: Record<string, unknown>[][]
}

function renderText(text: string) {
  // Strip markdown image syntax with data URIs — images arrive via the images[] array instead
  const cleaned = text.replace(/!\[[^\]]*\]\(data:image\/[^)]+\)/g, '')
  return cleaned.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    return (
      <p key={i} style={{ marginBottom: 6, lineHeight: 1.6, minHeight: line ? undefined : 8 }}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} style={{ color: '#93c5fd', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
            : part
        )}
      </p>
    )
  })
}

export default function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{
          maxWidth: '72%', padding: '10px 14px', borderRadius: '16px 16px 4px 16px',
          background: '#2563eb', color: '#fff', fontSize: 14, lineHeight: 1.5,
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
      <div style={{ maxWidth: '92%', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>AI</span>
          </div>
          <span style={{ fontSize: 11, color: '#4b5563' }}>Data Analysis AI</span>
        </div>
        <div style={{
          background: '#0f0f18', border: '1px solid #1f1f2e',
          borderRadius: '4px 16px 16px 16px', padding: '12px 14px',
        }}>
          {message.content && (
            <div style={{ fontSize: 14, color: '#d1d5db', marginBottom: message.codeBlocks?.length || message.images?.length || message.tables?.length ? 4 : 0 }}>
              {renderText(message.content)}
            </div>
          )}
          {message.codeBlocks?.map((code, i) => <CodeBlock key={i} code={code} />)}
          {message.images?.map((img, i) => <ChartImage key={i} b64={img} />)}
          {message.tables?.map((table, i) => <DataTable key={i} rows={table} />)}
        </div>
      </div>
    </div>
  )
}
