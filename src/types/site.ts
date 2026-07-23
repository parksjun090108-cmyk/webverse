export type Category =
  | 'Development'
  | 'AI'
  | 'Video'
  | 'SNS'
  | 'Design'
  | 'Productivity'
  | 'Shopping'
  | 'Music'
  | 'Education'
  | 'Games'
  | 'News'
  | 'Finance'
  | 'Community'
  | 'Entertainment'
  | 'Unclassified'

export type SiteStatus = 'APPROVED' | 'UNLISTED' | 'PENDING' | 'REVIEW_REQUESTED' | 'REJECTED_PRIVATE'

export type Site = {
  id: string
  name: string
  domain: string
  category: Category
  visitCount: number
  favorite: boolean
  browserFavorite?: boolean
  lastVisitedDaysAgo: number
  position: [number, number, number]
  color: string
  status: SiteStatus
  faviconUrl?: string | null
  reviewStatus?: 'REQUESTED' | 'APPROVED' | 'REJECTED' | null
  rejectionReason?: string | null
  anonymous?: boolean
}

export type CelestialStage =
  | '작은 별'
  | '일반 별'
  | '밝은 별'
  | '작은 행성'
  | '큰 행성'
  | '거대 행성'
