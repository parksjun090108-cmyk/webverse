import assert from 'node:assert/strict'
import { extractSiteMetadata, isPublicIp } from './siteMetadata.js'

const blocked = ['127.0.0.1', '10.0.0.1', '172.16.2.3', '192.168.1.2', '169.254.169.254', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']
for (const address of blocked) assert.equal(isPublicIp(address), false, `${address} must be blocked`)
for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) assert.equal(isPublicIp(address), true, `${address} must be public`)

const metadata = extractSiteMetadata(`<!doctype html><html><head>
  <title> Example &amp; Space </title>
  <meta name="description" content="A safe &quot;description&quot;">
  <meta name="theme-color" content="#6750a4">
  <link rel="icon" href="/assets/icon.png">
</head></html>`, new URL('https://www.example.com/path'))

assert.equal(metadata.domain, 'example.com')
assert.equal(metadata.title, 'Example & Space')
assert.equal(metadata.description, 'A safe "description"')
assert.equal(metadata.themeColor, '#6750a4')
assert.equal(metadata.faviconUrl, 'https://www.example.com/assets/icon.png')

const externalIcon = extractSiteMetadata('<title>Safe</title><link rel="icon" href="http://127.0.0.1/icon">', new URL('https://example.com'))
assert.equal(externalIcon.faviconUrl, null)

console.log('siteMetadata security tests passed')
