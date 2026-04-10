import { useRef } from 'react'

interface FileUploadProps {
  file: File | null
  onFileChange: (file: File | null) => void
}

export default function FileUpload({ file, onFileChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={e => onFileChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Upload CSV file"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 8, fontSize: 12,
          background: '#1a1a2e', border: '1px solid #2a2a3a',
          color: file ? '#93c5fd' : '#6b7280',
          transition: 'all 0.2s', whiteSpace: 'nowrap',
          maxWidth: 150, overflow: 'hidden',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {file ? file.name : 'CSV'}
        </span>
      </button>
      {file && (
        <button
          type="button"
          onClick={() => { onFileChange(null); if (inputRef.current) inputRef.current.value = '' }}
          style={{ color: '#6b7280', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
          title="Remove file"
        >
          ×
        </button>
      )}
    </div>
  )
}
