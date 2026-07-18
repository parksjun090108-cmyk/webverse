import type { Site } from '../types/site'

export const demoSites: Site[] = [
  { id: 'github', name: 'GitHub', domain: 'github.com', category: 'Development', visitCount: 187, favorite: true, lastVisitedDaysAgo: 1, position: [0, 0, 0], color: '#5c8cff', status: 'APPROVED' },
  { id: 'figma', name: 'Figma', domain: 'figma.com', category: 'Design', visitCount: 78, favorite: false, lastVisitedDaysAgo: 12, position: [0, 0, 0], color: '#ff72c7', status: 'APPROVED' },
  { id: 'youtube', name: 'YouTube', domain: 'youtube.com', category: 'Video', visitCount: 528, favorite: true, lastVisitedDaysAgo: 0, position: [0, 0, 0], color: '#ff4d67', status: 'APPROVED' },
  { id: 'discord', name: 'Discord', domain: 'discord.com', category: 'SNS', visitCount: 341, favorite: false, lastVisitedDaysAgo: 42, position: [0, 0, 0], color: '#68c8ff', status: 'APPROVED' },
  { id: 'notion', name: 'Notion', domain: 'notion.so', category: 'Productivity', visitCount: 46, favorite: true, lastVisitedDaysAgo: 5, position: [0, 0, 0], color: '#d7dce9', status: 'APPROVED' },
  { id: 'chatgpt', name: 'ChatGPT', domain: 'chatgpt.com', category: 'AI', visitCount: 126, favorite: false, lastVisitedDaysAgo: 2, position: [0, 0, 0], color: '#a978ff', status: 'APPROVED' },
  { id: 'vscode', name: 'VS Code', domain: 'code.visualstudio.com', category: 'Development', visitCount: 23, favorite: false, lastVisitedDaysAgo: 104, position: [0, 0, 0], color: '#5c8cff', status: 'APPROVED' },
  { id: 'canva', name: 'Canva', domain: 'canva.com', category: 'Design', visitCount: 8, favorite: false, lastVisitedDaysAgo: 201, position: [0, 0, 0], color: '#ff72c7', status: 'APPROVED' },
]
