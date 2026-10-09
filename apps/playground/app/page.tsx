import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>EditorX Playground</h1>
      <ul>
        <li><Link href="/showcase">组件展示 /showcase</Link></li>
        <li><Link href="/compare">还原度对照 /compare</Link></li>
        <li><Link href="/markdown-core">编辑引擎 /markdown-core</Link></li>
        <li><Link href="/markdown">Markdown 编辑器 /markdown</Link></li>
        <li><Link href="/publish">发布设置 /publish</Link></li>
      </ul>
    </main>
  )
}
