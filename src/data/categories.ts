import type { Category } from '../types/site'

export type CategoryDefinition = {
  name: Exclude<Category, 'Unclassified'>
  color: string
  anchor: [number, number, number]
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  { name: 'AI', color: '#a978ff', anchor: [0, 4.8, 2.8] },
  { name: 'Education', color: '#69d17d', anchor: [-3.2, 4.1, 0.8] },
  { name: 'Community', color: '#56b6cf', anchor: [-5.1, 2.2, -1.5] },
  { name: 'Development', color: '#5c8cff', anchor: [-5.3, -0.4, 2.1] },
  { name: 'Music', color: '#64e1c1', anchor: [-4.0, -3.2, -2.4] },
  { name: 'News', color: '#f3c96b', anchor: [-1.8, -4.8, 0.9] },
  { name: 'Video', color: '#ff4d67', anchor: [1.0, -5.0, 2.7] },
  { name: 'Productivity', color: '#d7dce9', anchor: [3.5, -4.0, -1.2] },
  { name: 'Finance', color: '#58d6a9', anchor: [5.2, -1.8, 1.2] },
  { name: 'Shopping', color: '#ff9f5c', anchor: [5.0, 1.1, -2.2] },
  { name: 'SNS', color: '#68c8ff', anchor: [3.8, 3.5, 2.1] },
  { name: 'Entertainment', color: '#d96fd8', anchor: [1.5, 5.0, -2.0] },
  { name: 'Design', color: '#ff72c7', anchor: [-1.8, 3.5, -4.0] },
  { name: 'Games', color: '#8c7aff', anchor: [0.4, -0.2, -5.8] },
]

export const CATEGORY_COLORS = Object.fromEntries(CATEGORY_DEFINITIONS.map((item) => [item.name, item.color])) as Record<Exclude<Category, 'Unclassified'>, string>
