import { copyFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { assertSqlite, backupDir, createBackup, localDatabasePath, sha256 } from './db-common.js'

const input = process.argv[2]
if (!input) throw new Error('사용법: pnpm db:restore -- backups/<백업파일>.db')
const backupPath = path.resolve(input)
if (path.dirname(backupPath) !== backupDir) throw new Error('프로젝트의 backups 폴더 안에 있는 파일만 복구할 수 있습니다.')
await assertSqlite(backupPath)
const manifest = JSON.parse(await readFile(`${backupPath}.json`, 'utf8')) as { sha256?: string }
if (manifest.sha256 !== await sha256(backupPath)) throw new Error('손상되거나 변경된 백업은 복구할 수 없습니다.')

const safety = await createBackup('before-restore')
await copyFile(backupPath, await localDatabasePath())
console.log(`복구 완료: ${path.basename(backupPath)}`)
console.log(`복구 전 DB 안전 백업: ${path.basename(safety.destination)}`)
console.log('WebVerse 서버를 다시 시작해주세요.')
