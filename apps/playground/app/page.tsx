import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>EditorX Playground</h1>
      <ul>
        <li><Link href="/showcase">组件展示 /showcase</Link></li>
        <li><Link href="/compare">还原度对照 /compare</Link></li>
      </ul>
    </main>
  )
}
