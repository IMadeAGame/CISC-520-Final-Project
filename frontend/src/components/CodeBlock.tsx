import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ margin: '10px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a3a' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 12px', background: '#1a1a2e', borderBottom: '1px solid #2a2a3a',
      }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>python</span>
        <button
          onClick={handleCopy}
          style={{ fontSize: 11, color: copied ? '#6ee7b7' : '#6b7280', padding: '2px 6px',
            borderRadius: 4, background: 'transparent', transition: 'color 0.2s' }}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language="python"
        style={oneDark}
        showLineNumbers
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.78rem', background: '#0d1117' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
