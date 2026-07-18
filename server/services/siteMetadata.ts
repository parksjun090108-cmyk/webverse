import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { IncomingMessage } from 'node:http'

const MAX_HTML_BYTES = 1_000_000
const REQUEST_TIMEOUT_MS = 5_000
const TOTAL_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3
const ALLOWED_PORTS = new Set(['', '80', '443'])

export class UnsafeUrlError extends Error {}
export class MetadataFetchError extends Error {}

export type SiteMetadata = {
  url: string
  domain: string
  title: string
  description: string | null
  faviconUrl: string | null
  themeColor: string | null
}

export async function collectSiteMetadata(input: string): Promise<SiteMetadata> {
  const initialUrl = normalizeUrl(input)
  const response = await fetchHtml(initialUrl, 0, Date.now() + TOTAL_TIMEOUT_MS)
  return extractSiteMetadata(response.html, response.finalUrl)
}

export function extractSiteMetadata(html: string, finalUrl: URL): SiteMetadata {
  const domain = finalUrl.hostname.toLowerCase().replace(/^www\./, '')
  const title = cleanText(firstMatch(html, [
    /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ])) || domain.split('.')[0] || domain
  const description = cleanText(firstMatch(html, [
    /<meta\s+[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i,
  ])).slice(0, 300) || null
  const iconHref = firstMatch(html, [
    /<link\s+[^>]*rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i,
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]*>/i,
  ])
  const themeColor = cleanColor(firstMatch(html, [
    /<meta\s+[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["'][^>]*>/i,
  ]))

  return {
    url: `${finalUrl.protocol}//${finalUrl.host}${finalUrl.pathname === '/' ? '' : finalUrl.pathname}`,
    domain,
    title: title.slice(0, 120),
    description,
    faviconUrl: safeAssetUrl(iconHref, finalUrl),
    themeColor,
  }
}

function normalizeUrl(input: string) {
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new UnsafeUrlError('올바른 URL을 입력해주세요.') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UnsafeUrlError('HTTP 또는 HTTPS 주소만 허용합니다.')
  if (url.username || url.password) throw new UnsafeUrlError('사용자 정보가 포함된 URL은 허용하지 않습니다.')
  if (!ALLOWED_PORTS.has(url.port)) throw new UnsafeUrlError('기본 웹 포트(80, 443)만 허용합니다.')
  url.hash = ''
  return url
}

async function validateTarget(url: URL, deadline: number) {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new UnsafeUrlError('내부 네트워크 주소는 등록할 수 없습니다.')
  }
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new MetadataFetchError('사이트 분석 시간이 초과되었습니다.')
  const addresses = await lookupWithTimeout(hostname, Math.min(remaining, REQUEST_TIMEOUT_MS))
  if (!addresses.length) throw new MetadataFetchError('사이트 주소를 확인할 수 없습니다.')
  if (addresses.some(({ address }) => !isPublicIp(address))) throw new UnsafeUrlError('내부 또는 비공개 네트워크 주소는 등록할 수 없습니다.')
  return addresses
}

function lookupWithTimeout(hostname: string, timeout: number) {
  return new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new MetadataFetchError('DNS 확인 시간이 초과되었습니다.')), timeout)
    dns.lookup(hostname, { all: true, verbatim: true }).then((addresses) => {
      clearTimeout(timer); resolve(addresses)
    }).catch(() => { clearTimeout(timer); resolve([]) })
  })
}

async function fetchHtml(url: URL, redirectCount: number, deadline: number): Promise<{ html: string; finalUrl: URL }> {
  if (redirectCount > MAX_REDIRECTS) throw new MetadataFetchError('리다이렉트가 너무 많습니다.')
  const addresses = await validateTarget(url, deadline)
  const response = await request(url, addresses, deadline)
  if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
    const location = response.headers.location
    response.resume()
    if (!location) throw new MetadataFetchError('잘못된 리다이렉트 응답입니다.')
    return fetchHtml(normalizeUrl(new URL(location, url).toString()), redirectCount + 1, deadline)
  }
  if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
    response.resume(); throw new MetadataFetchError(`사이트가 HTTP ${response.statusCode} 응답을 반환했습니다.`)
  }
  const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    response.resume(); throw new MetadataFetchError('HTML 웹페이지만 등록할 수 있습니다.')
  }
  if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
    response.resume(); throw new MetadataFetchError('압축된 응답은 처리할 수 없습니다.')
  }
  const declaredLength = Number(response.headers['content-length'] ?? 0)
  if (declaredLength > MAX_HTML_BYTES) { response.resume(); throw new MetadataFetchError('웹페이지의 크기가 너무 큽니다.') }
  return { html: await readLimited(response), finalUrl: url }
}

function request(url: URL, addresses: Awaited<ReturnType<typeof validateTarget>>, deadline: number) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http
    let addressIndex = 0
    const operation = client.request({
      protocol: url.protocol, hostname: url.hostname, port: url.port || undefined,
      path: `${url.pathname}${url.search}`, method: 'GET',
      headers: { 'User-Agent': 'WebVerse-Metadata/1.0', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
      lookup: (_hostname, options, callback) => {
        const address = addresses[addressIndex++ % addresses.length]!
        if (typeof options === 'object' && options.all) callback(null, addresses)
        else callback(null, address.address, address.family)
      },
      servername: url.hostname,
    }, resolve)
    operation.setTimeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now())), () => operation.destroy(new MetadataFetchError('사이트 응답 시간이 초과되었습니다.')))
    operation.on('error', (error) => reject(error instanceof UnsafeUrlError || error instanceof MetadataFetchError ? error : new MetadataFetchError('사이트 정보를 가져오지 못했습니다.')))
    operation.end()
  })
}

async function readLimited(response: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_HTML_BYTES) { response.destroy(); throw new MetadataFetchError('웹페이지의 크기가 너무 큽니다.') }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function firstMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) { const value = pattern.exec(html)?.[1]; if (value) return value }
  return ''
}

function cleanText(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x'
      const point = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function safeAssetUrl(value: string, pageUrl: URL) {
  try {
    const icon = value ? new URL(value, pageUrl) : new URL('/favicon.ico', pageUrl)
    if (!['http:', 'https:'].includes(icon.protocol) || icon.hostname !== pageUrl.hostname) return null
    return icon.toString().slice(0, 500)
  } catch { return null }
}

function cleanColor(value: string) {
  const color = value.trim()
  return /^(#[0-9a-f]{3,8}|rgb\([0-9 ,.]+\)|hsl\([0-9 ,.%-]+\))$/i.test(color) ? color.slice(0, 40) : null
}

export function isPublicIp(address: string) {
  const family = net.isIP(address)
  if (family === 4) {
    const parts = address.split('.').map(Number)
    const [a, b] = parts
    if (a === undefined || b === undefined) return false
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && parts[2] === 2) || (a === 198 && b === 51 && parts[2] === 100) ||
      (a === 203 && b === 0 && parts[2] === 113))
  }
  if (family === 6) {
    const value = address.toLowerCase()
    if (value.startsWith('::ffff:')) return isPublicIp(value.slice(7))
    return !(value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') ||
      /^fe[89ab]/.test(value) || value.startsWith('ff') || value.startsWith('2001:db8:'))
  }
  return false
}
