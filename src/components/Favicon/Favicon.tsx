import { useState } from 'react'

const loadedFavicons = new Set<string>()
const failedFavicons = new Set<string>()

export function Favicon({ src, name, className = '' }: { src?: string | null; name: string; className?: string }) {
  const [loaded, setLoaded] = useState(() => Boolean(src && loadedFavicons.has(src)))
  const [failed, setFailed] = useState(() => Boolean(src && failedFavicons.has(src)))

  if (!src || failed) return <span className={`favicon-fallback ${className}`}>{name.slice(0, 1).toUpperCase()}</span>
  return <span className={`favicon-frame ${className}`}>
    {!loaded && <span className="favicon-fallback">{name.slice(0, 1).toUpperCase()}</span>}
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      style={{ opacity: loaded ? 1 : 0 }}
      onLoad={() => { loadedFavicons.add(src); setLoaded(true) }}
      onError={() => { failedFavicons.add(src); setFailed(true) }}
    />
  </span>
}
