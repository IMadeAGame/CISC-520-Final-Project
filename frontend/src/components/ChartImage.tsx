export default function ChartImage({ b64 }: { b64: string }) {
  return (
    <div style={{ margin: '10px 0' }}>
      <img
        src={`data:image/png;base64,${b64}`}
        alt="Generated chart"
        style={{
          maxWidth: '100%', maxHeight: 480,
          objectFit: 'contain', borderRadius: 8,
          border: '1px solid #2a2a3a',
          display: 'block',
        }}
      />
    </div>
  )
}
