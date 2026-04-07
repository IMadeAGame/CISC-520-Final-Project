import { useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function askAgent() {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('http://localhost:8000/agent')
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setMessage(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agent-container">
      <h1>AI Agent</h1>
      <p className="subtitle">Powered by Hugging Face LLM</p>
      <button className="ask-btn" onClick={askAgent} disabled={loading}>
        {loading ? 'Thinking…' : 'Ask Agent'}
      </button>
      {message && (
        <div className="response-box">
          <strong>Agent says:</strong>
          <p>{message}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default App
