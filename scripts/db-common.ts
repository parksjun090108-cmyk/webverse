import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const projectRoot = path.resolve(import.meta.dirname, '..')
export const backupDir = path.join(projectRoot, 'backups')

export async function localDatabasePath() {
  const envText = await readFile(path.join(projectRoot, '.env'), 'utf8')
  const match = envText.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m)
  const value = process.env.DATABASE_URL || match?.[1]
  if (!value?.startsWith('file:')) throw new Error('이 명령은 로컬 SQLite DATABASE_URL에서만 사용할 수 있습니다.')
  const filePath = value.slice('file:'.length)
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, 'prisma', filePath)
}

export async function sha256(filePath: string) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

export async function assertSqlite(filePath: string) {
  const info = await stat(filePath)
  if (info.size < 100) throw new Error('데이터베이스 파일이 비어 있거나 손상되었습니다.')
  const bytes = await readFile(filePath)
  if (bytes.subarray(0, 16).toString('binary') !== 'SQLite format 3\0') throw new Error('올바른 SQLite 데이터베이스가 아닙니다.')
  return info
}

export async function createBackup(label = 'manual') {
  const source = await localDatabasePath()
  await assertSqlite(source)
  await mkdir(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  const destination = path.join(backupDir, `webverse_${label}_${stamp}.db`)
  await copyFile(source, destination)
  const info = await assertSqlite(destination)
  const hash = await sha256(destination)
  await writeFile(`${destination}.json`, JSON.stringify({ createdAt: new Date().toISOString(), source: 'prisma/dev.db', bytes: info.size, sha256: hash }, null, 2))
  return { destination, bytes: info.size, hash }
}
