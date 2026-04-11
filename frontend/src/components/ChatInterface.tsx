import { useState, useRef, useEffect } from 'react'
import MessageBubble, { type Message } from './MessageBubble'
import ExamplePrompts from './ExamplePrompts'
import FileUpload from './FileUpload'

const API_URL = 'https://stock-data-analysis-ai-back-end.onrender.com/chat/stream'

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Add a placeholder assistant message we'll update as tokens arrive
    const assistantIdx = updated.length
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const formData = new FormData()
      formData.append('messages', JSON.stringify(
        updated.map(m => ({ role: m.role, content: m.content }))
      ))
      if (file) formData.append('file', file)

      const res = await fetch(API_URL, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(raw) } catch { continue }

          if (evt.type === 'token') {
            setMessages(prev => {
              const next = [...prev]
              const msg = next[assistantIdx]
              next[assistantIdx] = { ...msg, content: msg.content + (evt.content as string) }
              return next
            })
          } else if (evt.type === 'done') {
            setMessages(prev => {
              const next = [...prev]
              next[assistantIdx] = {
                role: 'assistant',
                content: (evt.reply as string) || prev[assistantIdx].content,
                codeBlocks: (evt.code_blocks as string[]) || [],
                images: (evt.images as string[]) || [],
                tables: (evt.tables as Record<string, unknown>[][]) || [],
              }
              return next
            })
          } else if (evt.type === 'error') {
            setMessages(prev => {
              const next = [...prev]
              next[assistantIdx] = { role: 'assistant', content: `Error: ${evt.message}` }
              return next
            })
          }
        }
      }

      setFile(null)
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        next[assistantIdx] = {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Something went wrong. Is the backend running?'}`,
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0f' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', padding: '10px 20px',
        borderBottom: '1px solid #1f1f2e', background: '#0d0d16', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>AI</span>
          </div>
          <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: 14 }}>Data Analysis AI</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ marginLeft: 'auto', fontSize: 12, color: '#4b5563', padding: '4px 8px',
              borderRadius: 6, background: '#1a1a2e', border: '1px solid #2a2a3a' }}
          >
            New chat
          </button>
        )}
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', height: '100%' }}>
            <ExamplePrompts onSelect={p => { setInput(p); textareaRef.current?.focus() }} />
          </div>
        ) : (
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>
            {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
            {loading && messages[messages.length - 1]?.content === '' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  background: '#0f0f18', border: '1px solid #1f1f2e',
                  borderRadius: '4px 16px 16px 16px', padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {[0, 150, 300].map(delay => (
                      <div key={delay} style={{
                        width: 7, height: 7, borderRadius: '50%', background: '#3b82f6',
                        animation: 'bounce 1s infinite', animationDelay: `${delay}ms`,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid #1f1f2e', background: '#0d0d16', padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: '#0f0f18', border: '1px solid #2a2a3a', borderRadius: 12, padding: '8px 10px',
            transition: 'border-color 0.2s',
          }}
            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#3b5bdb'}
            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#2a2a3a'}
          >
            <FileUpload file={file} onFileChange={setFile} />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to analyze..."
              rows={1}
              style={{
                flex: 1, background: 'transparent', outline: 'none', resize: 'none',
                fontSize: 14, color: '#e2e8f0', lineHeight: 1.5, border: 'none',
                padding: '4px 4px', maxHeight: 160, overflowY: 'auto',
              }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = `${Math.min(t.scrollHeight, 160)}px`
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: !input.trim() || loading ? '#1f1f2e' : '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#374151', marginTop: 6 }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
