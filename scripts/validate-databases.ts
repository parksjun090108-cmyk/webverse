import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sqlite = await readFile(path.join(root, 'prisma/schema.prisma'), 'utf8')
const postgres = await readFile(path.join(root, 'prisma/schema.postgresql.prisma'), 'utf8')
const migrationsRoot = path.join(root, 'prisma/migrations')
const migrationDirectories = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
const migration = (await Promise.all(migrationDirectories.map((directory) =>
  readFile(path.join(migrationsRoot, directory, 'migration.sql'), 'utf8'),
))).join('\n')

const normalize = (schema: string) => schema
  .replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, 'provider = "DATABASE"')
  .replace(/url\s*=\s*env\("DATABASE_URL"\)/, 'url = env("DATABASE_URL")')
  .replace(/\s*directUrl\s*=\s*env\("DIRECT_URL"\)/, '')
  .replace(/\r\n/g, '\n')
  .trim()
if (normalize(sqlite) !== normalize(postgres)) throw new Error('SQLite와 PostgreSQL Prisma 모델 구조가 서로 다릅니다.')

const models = [...postgres.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1])
const missingTables = models.filter((model) => !migration.includes(`CREATE TABLE "${model}"`))
if (missingTables.length) throw new Error(`PostgreSQL 초기 마이그레이션에 테이블이 없습니다: ${missingTables.join(', ')}`)
console.log(`DB 구조 검증 완료: ${models.length}개 모델 · SQLite/PostgreSQL 일치`)
