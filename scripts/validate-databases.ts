import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sqlite = await readFile(path.join(root, 'prisma/schema.prisma'), 'utf8')
const postgres = await readFile(path.join(root, 'prisma/schema.postgresql.prisma'), 'utf8')
const migration = await readFile(path.join(root, 'prisma/migrations/20260718000000_init_postgresql/migration.sql'), 'utf8')

const normalize = (schema: string) => schema.replace(/provider\s*=\s*"(?:sqlite|postgresql)"/, 'provider = "DATABASE"').replace(/\r\n/g, '\n').trim()
if (normalize(sqlite) !== normalize(postgres)) throw new Error('SQLite와 PostgreSQL Prisma 모델 구조가 서로 다릅니다.')

const models = [...postgres.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1])
const missingTables = models.filter((model) => !migration.includes(`CREATE TABLE "${model}"`))
if (missingTables.length) throw new Error(`PostgreSQL 초기 마이그레이션에 테이블이 없습니다: ${missingTables.join(', ')}`)
console.log(`DB 구조 검증 완료: ${models.length}개 모델 · SQLite/PostgreSQL 일치`)
