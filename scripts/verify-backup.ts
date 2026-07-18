import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { assertSqlite, backupDir, sha256 } from './db-common.js'

const input = process.argv[2]
if (!input) throw new Error('사용법: pnpm db:backup:verify -- backups/<백업파일>.db')
const backupPath = path.resolve(input)
if (path.dirname(backupPath) !== backupDir) throw new Error('프로젝트의 backups 폴더 안에 있는 파일만 검증할 수 있습니다.')
await assertSqlite(backupPath)
const manifest = JSON.parse(await readFile(`${backupPath}.json`, 'utf8')) as { sha256?: string; bytes?: number }
const actualHash = await sha256(backupPath)
if (!manifest.sha256 || manifest.sha256 !== actualHash) throw new Error('백업 검증값이 일치하지 않습니다. 파일이 변경되었을 수 있습니다.')
console.log(`백업 정상: ${path.basename(backupPath)} (${manifest.bytes?.toLocaleString() ?? '?'} bytes)`)
