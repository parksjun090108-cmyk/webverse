import path from 'node:path'
import { createBackup, projectRoot } from './db-common.js'

const result = await createBackup()
console.log(`백업 완료: ${path.relative(projectRoot, result.destination)}`)
console.log(`크기: ${result.bytes.toLocaleString()} bytes`)
console.log(`검증값: ${result.hash}`)
console.log('주의: 백업 중에는 WebVerse 서버를 종료해두는 것이 가장 안전합니다.')
