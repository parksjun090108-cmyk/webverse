import { useState } from 'react'
import { Check, Edit3, GitBranch, Sparkles, X } from 'lucide-react'
import type { ConstellationView } from '../../types/constellation'

type Props = {
  constellations: ConstellationView[]
  onRename: (id: string, name: string) => Promise<void> | void
}

export function ConstellationsPage({ constellations, onRename }: Props) {
  const [selectedId, setSelectedId] = useState(constellations[0]?.id ?? null)
  const [editing, setEditing] = useState(false)
  const selected = constellations.find((item) => item.id === selectedId) ?? constellations[0]
  const [draft, setDraft] = useState(selected?.name ?? '')
  const routePoints = selected ? constellationPoints(selected.sites.length) : []
  const pointBySiteId = new Map(selected?.sites.map((site, index) => [site.id, routePoints[index]!]) ?? [])

  const select = (item: ConstellationView) => { setSelectedId(item.id); setDraft(item.name); setEditing(false) }
  const save = async () => {
    if (!selected || !draft.trim()) return
    await onRename(selected.id, draft.trim()); setEditing(false)
  }

  return (
    <section className="constellations-page">
      <div className="constellation-haze" />
      <div className="constellations-content">
        <p className="constellation-kicker"><GitBranch size={13} /> CONNECTED WORLDS</p>
        <h1>자주 오간 세계가 이어 만든<br /><em>당신만의 별자리.</em></h1>

        {!selected ? <div className="constellation-empty glass-panel">
          <div><Sparkles size={25} /></div><h2>아직 발견된 별자리가 없어요.</h2><p>여러 사이트를 오가며 연결을 만들어보세요.</p>
          <span>3회 생성 · 5회 강화 · 10회 강조</span>
        </div> : <div className="constellation-workspace">
          <article className={`constellation-map glass-panel strength-${selected.strength}`}>
            <div className="map-stars" />
            <div className="map-header">
              <span>CONSTELLATION #{selected.id.slice(-4).toUpperCase()}</span>
              <strong>{selected.edges?.length ?? 0}개 연결 · 최소 {selected.occurrenceCount}회</strong>
            </div>
            <div className="constellation-route">
              <svg viewBox="0 0 700 260" aria-hidden="true">
                {(selected.edges ?? []).map((edge) => {
                  const from = pointBySiteId.get(edge.fromSiteId)
                  const to = pointBySiteId.get(edge.toSiteId)
                  if (!from || !to) return null
                  const strength = edge.count >= 10 ? 3 : edge.count >= 5 ? 2 : 1
                  return <g key={`${edge.fromSiteId}-${edge.toSiteId}`} className={`edge-strength-${strength}`}>
                    {strength >= 2 && <line className="line-glow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />}
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                  </g>
                })}
              </svg>
              {selected.sites.map((site, index) => {
                const point = routePoints[index]!
                return <div className="route-site" key={`${site.id}-${index}`} style={{ left: `${point.x / 7}%`, top: `${point.y / 2.6}%`, '--route-color': site.color } as React.CSSProperties}>
                  <i>{site.name[0]}</i><strong>{site.name}</strong><span>0{index + 1}</span>
                </div>
              })}
            </div>
            <div className="constellation-name">
              {editing ? <div className="rename-field"><input value={draft} maxLength={40} onChange={(event) => setDraft(event.target.value)} autoFocus /><button onClick={save}><Check size={15} /></button><button onClick={() => setEditing(false)}><X size={15} /></button></div>
                : <><div><span>별자리 이름</span><h2>{selected.name}</h2></div><button onClick={() => setEditing(true)}><Edit3 size={15} /> 이름 수정</button></>}
            </div>
          </article>

          <aside className="constellation-list glass-panel">
            <div className="list-title"><span>YOUR CONSTELLATIONS</span><strong>{constellations.length}</strong></div>
            {constellations.map((item) => <button key={item.id} className={item.id === selected.id ? 'active' : ''} onClick={() => select(item)}>
              <span className="mini-route">{item.sites.map((site, index) => <i key={`${site.id}-${index}`} style={{ background: site.color }} />)}</span>
              <span><strong>{item.name}</strong><small>{item.sites.map((site) => site.name).join(' · ')}</small></span>
              <em>×{item.occurrenceCount}</em>
            </button>)}
          </aside>
        </div>}
      </div>
    </section>
  )
}

function constellationPoints(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2
    return { x: 350 + Math.cos(angle) * 235, y: 130 + Math.sin(angle) * 88 }
  })
}
