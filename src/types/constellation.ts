export type ConstellationView = {
  id: string
  name: string
  strength: number
  occurrenceCount: number
  sites: Array<{ id: string; name: string; color: string }>
  edges: Array<{ fromSiteId: string; toSiteId: string; count: number }>
}
