export type CelestialVisualProfile = {
  preset: 'default' | 'youtube' | 'github' | 'google' | 'netflix' | 'discord' | 'figma' | 'notion' | 'steam'
    | 'chatgpt' | 'claude' | 'gemini' | 'stackoverflow' | 'vercel' | 'canva' | 'twitch' | 'tiktok'
    | 'instagram' | 'x' | 'linkedin' | 'slack' | 'spotify' | 'amazon' | 'coupang' | 'reddit'
    | 'gitlab' | 'npm' | 'adobe' | 'facebook' | 'trello' | 'duolingo' | 'epicgames' | 'binance'
  variant: number
  rotationSpeed: number
  tilt: number
  stretch: number
  bandCount: number
  satelliteCount: number
  ringTilt: number
}

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function getCelestialVisualProfile(id: string, visits: number, domain = ''): CelestialVisualProfile {
  const seed = hash(id)
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '')
  const preset = normalizedDomain.includes('youtube.com') ? 'youtube'
    : normalizedDomain.includes('github.com') ? 'github'
      : normalizedDomain === 'google.com' ? 'google'
        : normalizedDomain === 'chatgpt.com' || normalizedDomain === 'openai.com' ? 'chatgpt'
          : normalizedDomain === 'claude.ai' ? 'claude'
            : normalizedDomain === 'gemini.google.com' ? 'gemini'
              : normalizedDomain === 'stackoverflow.com' ? 'stackoverflow'
                : normalizedDomain === 'vercel.com' ? 'vercel'
                  : normalizedDomain === 'canva.com' ? 'canva'
                    : normalizedDomain === 'twitch.tv' ? 'twitch'
                      : normalizedDomain === 'tiktok.com' ? 'tiktok'
                        : normalizedDomain === 'instagram.com' ? 'instagram'
                          : normalizedDomain === 'x.com' || normalizedDomain === 'twitter.com' ? 'x'
                            : normalizedDomain === 'linkedin.com' ? 'linkedin'
                              : normalizedDomain === 'slack.com' ? 'slack'
                                : normalizedDomain === 'spotify.com' ? 'spotify'
                                  : normalizedDomain === 'amazon.com' ? 'amazon'
                                    : normalizedDomain === 'coupang.com' ? 'coupang'
                                      : normalizedDomain === 'reddit.com' ? 'reddit'
                                        : normalizedDomain === 'gitlab.com' ? 'gitlab'
                                          : normalizedDomain === 'npmjs.com' ? 'npm'
                                            : normalizedDomain === 'adobe.com' ? 'adobe'
                                              : normalizedDomain === 'facebook.com' ? 'facebook'
                                                : normalizedDomain === 'trello.com' ? 'trello'
                                                  : normalizedDomain === 'duolingo.com' ? 'duolingo'
                                                    : normalizedDomain === 'epicgames.com' ? 'epicgames'
                                                      : normalizedDomain === 'binance.com' ? 'binance'
        : normalizedDomain.includes('netflix.com') ? 'netflix'
          : normalizedDomain.includes('discord.com') ? 'discord'
            : normalizedDomain.includes('figma.com') ? 'figma'
              : normalizedDomain.includes('notion.') ? 'notion'
                : normalizedDomain.includes('steampowered.com') || normalizedDomain.includes('steamcommunity.com') ? 'steam' : 'default'
  return {
    preset,
    variant: seed % 4,
    rotationSpeed: (0.0012 + ((seed >>> 5) % 10) * 0.00022) * ((seed & 1) ? 1 : -1),
    tilt: (((seed >>> 9) % 100) / 100 - 0.5) * 0.7,
    stretch: (((seed >>> 16) % 100) / 100 - 0.5) * 0.16,
    bandCount: visits >= 50 ? 2 + ((seed >>> 21) % 3) : 0,
    satelliteCount: visits >= 150 ? 2 : visits >= 100 ? 1 : 0,
    ringTilt: 0.85 + ((seed >>> 12) % 100) / 120,
  }
}
