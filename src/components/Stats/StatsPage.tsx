import { Activity, Globe2, Heart, Orbit, TrendingUp } from 'lucide-react'
import type { Site } from '../../types/site'
import { getCelestialStage } from '../../engine/UniverseEngine'

type Props = { sites: Site[] }

export function StatsPage({ sites }: Props) {
  const visits = sites.reduce((sum, site) => sum + site.visitCount, 0)
  const favorites = sites.filter((site) => site.favorite).length
  const active = sites.filter((site) => site.lastVisitedDaysAgo <= 30).length
  const topSites = [...sites].sort((a, b) => b.visitCount - a.visitCount).slice(0, 5)
  const maxVisits = Math.max(1, topSites[0]?.visitCount ?? 1)
  const categoryCounts = sites.reduce<Record<string, { count: number; color: string }>>((result, site) => {
    const current = result[site.category] ?? { count: 0, color: site.color }
    result[site.category] = { ...current, count: current.count + 1 }
    return result
  }, {})
  const categories = Object.entries(categoryCounts).sort((a, b) => b[1].count - a[1].count)

  return (
    <section className="stats-page">
      <div className="stats-content">
        <p className="stats-kicker"><Activity size={13} /> UNIVERSE SIGNALS</p>
        <h1>당신의 우주가 남긴<br /><em>탐험의 기록.</em></h1>
        <p className="stats-intro">발견한 세계와 방문 습관을 한눈에 확인하세요.</p>

        <div className="summary-grid">
          <StatCard icon={<Globe2 />} label="발견한 세계" value={`${sites.length}`} suffix="개" />
          <StatCard icon={<TrendingUp />} label="누적 방문" value={visits.toLocaleString()} suffix="회" />
          <StatCard icon={<Heart />} label="즐겨찾기" value={`${favorites}`} suffix="개" />
          <StatCard icon={<Orbit />} label="최근 30일 활성" value={`${active}`} suffix="개" />
        </div>

        <div className="stats-panels">
          <article className="stats-panel glass-panel">
            <div className="panel-heading"><div><span>MOST VISITED</span><h2>가장 자주 찾은 세계</h2></div><small>누적 방문 기준</small></div>
            <div className="ranking-list">
              {topSites.length ? topSites.map((site, index) => (
                <div className="ranking-row" key={site.id}>
                  <span className="rank">0{index + 1}</span>
                  <i className="rank-planet" style={{ '--rank-color': site.color } as React.CSSProperties} />
                  <div className="rank-name"><strong>{site.name}</strong><span>{getCelestialStage(site.visitCount)}</span></div>
                  <div className="rank-bar"><i style={{ width: `${Math.max(8, site.visitCount / maxVisits * 100)}%`, background: site.color }} /></div>
                  <strong className="rank-value">{site.visitCount.toLocaleString()}</strong>
                </div>
              )) : <p className="empty-stats">사이트를 발견하면 방문 통계가 표시됩니다.</p>}
            </div>
          </article>

          <article className="stats-panel category-panel glass-panel">
            <div className="panel-heading"><div><span>CATEGORY MAP</span><h2>카테고리 분포</h2></div></div>
            <div className="category-visual">
              <div className="donut" style={{ '--segments': makeGradient(categories, sites.length) } as React.CSSProperties}>
                <div><strong>{sites.length}</strong><span>WORLDs</span></div>
              </div>
              <div className="category-stat-list">
                {categories.map(([name, data]) => <div key={name}><span><i style={{ background: data.color }} />{name}</span><strong>{data.count}<small>개</small></strong></div>)}
                {!categories.length && <p className="empty-stats">아직 카테고리가 없습니다.</p>}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix: string }) {
  return <article className="stat-card glass-panel"><span>{icon}</span><div><p>{label}</p><strong>{value}<small>{suffix}</small></strong></div></article>
}

function makeGradient(categories: Array<[string, { count: number; color: string }]>, total: number) {
  if (!total) return '#20263a 0 100%'
  let start = 0
  return categories.map(([, data]) => {
    const end = start + data.count / total * 100
    const part = `${data.color} ${start}% ${end}%`
    start = end
    return part
  }).join(', ')
}
