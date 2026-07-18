import assert from 'node:assert/strict'
import { getCelestialVisualProfile } from './CelestialVisualEngine'

const first = getCelestialVisualProfile('github', 600)
assert.deepEqual(first, getCelestialVisualProfile('github', 600), 'visual profile must remain stable')
assert.notDeepEqual(first, getCelestialVisualProfile('youtube', 600), 'different sites should have visual variation')
assert.equal(getCelestialVisualProfile('small', 49).bandCount, 0)
assert.ok(getCelestialVisualProfile('planet', 50).bandCount >= 2)
assert.equal(getCelestialVisualProfile('large', 100).satelliteCount, 1)
assert.equal(getCelestialVisualProfile('giant', 150).satelliteCount, 2)
assert.equal(getCelestialVisualProfile('youtube-id', 10, 'youtube.com').preset, 'youtube')
assert.equal(getCelestialVisualProfile('github-id', 10, 'github.com').preset, 'github')
const signatures = {
  'google.com': 'google', 'netflix.com': 'netflix', 'discord.com': 'discord', 'figma.com': 'figma', 'notion.so': 'notion',
  'steampowered.com': 'steam', 'chatgpt.com': 'chatgpt', 'claude.ai': 'claude', 'gemini.google.com': 'gemini',
  'stackoverflow.com': 'stackoverflow', 'vercel.com': 'vercel', 'canva.com': 'canva', 'twitch.tv': 'twitch',
  'tiktok.com': 'tiktok', 'instagram.com': 'instagram', 'x.com': 'x', 'linkedin.com': 'linkedin', 'slack.com': 'slack',
  'spotify.com': 'spotify', 'amazon.com': 'amazon', 'coupang.com': 'coupang', 'reddit.com': 'reddit',
  'gitlab.com': 'gitlab', 'npmjs.com': 'npm', 'adobe.com': 'adobe', 'facebook.com': 'facebook',
  'trello.com': 'trello', 'duolingo.com': 'duolingo', 'epicgames.com': 'epicgames', 'binance.com': 'binance',
} as const
for (const [domain, preset] of Object.entries(signatures)) {
  assert.equal(getCelestialVisualProfile(domain, 10, domain).preset, preset, `${domain} signature`)
}
assert.equal(getCelestialVisualProfile('unknown-id', 10, 'example.com').preset, 'default')

console.log('Celestial visual variation tests passed')
