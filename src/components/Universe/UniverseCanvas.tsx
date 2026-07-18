import { Canvas, useFrame } from '@react-three/fiber'
import { Billboard, Detailed, Line, OrbitControls, Sparkles, Stars, Text } from '@react-three/drei'
import { memo, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, BackSide, Color, type Group, type Mesh } from 'three'
import type { Site } from '../../types/site'
import { getActivityBrightness, getCelestialScale } from '../../engine/UniverseEngine'
import { CATEGORY_ANCHORS } from '../../engine/LayoutEngine'
import type { SiteCluster } from '../../engine/DisplayEngine'
import type { ConstellationView } from '../../types/constellation'
import { getCelestialVisualProfile, type CelestialVisualProfile } from '../../engine/CelestialVisualEngine'

type Props = {
  sites: Site[]
  selectedId: string | null
  onSelect: (site: Site) => void
  clusters: SiteCluster[]
  onExpandCluster: (category: Site['category']) => void
  constellations: ConstellationView[]
}

function Sun() {
  const ref = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.08
  })

  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[1.15, 48, 48]} />
        <meshStandardMaterial color="#ffd36a" emissive="#ff9d2e" emissiveIntensity={2.8} />
      </mesh>
      <pointLight color="#ffbf69" intensity={35} distance={24} decay={1.7} />
      <Sparkles count={28} scale={3.5} size={2.4} speed={0.28} color="#ffd987" />
    </group>
  )
}

const CelestialBody = memo(function CelestialBody({ site, selected, onSelect }: { site: Site; selected: boolean; onSelect: (site: Site) => void }) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const scale = getCelestialScale(site.visitCount)
  const brightness = getActivityBrightness(site.lastVisitedDaysAgo)
  const isPlanet = site.visitCount >= 50
  const profile = useMemo(() => getCelestialVisualProfile(site.id, site.visitCount, site.domain), [site.domain, site.id, site.visitCount])
  const surfaceColor = useMemo(() => {
    const presetColors: Partial<Record<CelestialVisualProfile['preset'], string>> = {
      youtube: '#ff304d', github: '#242a38', google: '#4f8cff', netflix: '#7c1025',
      discord: '#7668f2', figma: '#ff5f57', notion: '#e8e8e8', steam: '#397ba5',
      chatgpt: '#45a98d', claude: '#c77f58', gemini: '#766be8', stackoverflow: '#e98635', vercel: '#d8dce7',
      canva: '#28b9c8', twitch: '#8d5deb', tiktok: '#182238', instagram: '#d94f91', x: '#dce3ed',
      linkedin: '#3078b7', slack: '#793b74', spotify: '#36bc67', amazon: '#26364d', coupang: '#e94f58', reddit: '#f35a32',
      gitlab: '#e45d35', npm: '#bd3437', adobe: '#df3344', facebook: '#3e72d6', trello: '#367db7', duolingo: '#62c943', epicgames: '#31333b', binance: '#d9ae35',
    }
    if (presetColors[profile.preset]) return presetColors[profile.preset]!
    const color = new Color(site.color)
    color.offsetHSL((profile.variant - 1.5) * 0.018, profile.variant % 2 ? 0.08 : -0.04, (profile.variant - 1.5) * 0.035)
    return `#${color.getHexString()}`
  }, [profile.variant, site.color])

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.position.y = site.position[1] + Math.sin(clock.elapsedTime * 0.55 + site.position[0]) * 0.08
      group.current.rotation.y += profile.rotationSpeed
    }
  })

  return (
    <group ref={group} position={site.position} onClick={(event) => { event.stopPropagation(); onSelect(site) }} onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <Detailed distances={[0, 11, 18]}>
        <BodyMesh color={surfaceColor} profile={profile} brightness={brightness} isPlanet={isPlanet} scale={selected ? scale * 1.12 : scale} segments={isPlanet ? 48 : 28} />
        <BodyMesh color={surfaceColor} profile={profile} brightness={brightness} isPlanet={isPlanet} scale={selected ? scale * 1.12 : scale} segments={16} />
        <BodyMesh color={surfaceColor} profile={profile} brightness={brightness} isPlanet={isPlanet} scale={selected ? scale * 1.12 : scale} segments={7} />
      </Detailed>
      {!isPlanet && <StarEffects color={surfaceColor} scale={scale} brightness={brightness} bright={site.visitCount >= 20} variant={profile.variant} />}
      {isPlanet && <PlanetDetails color={surfaceColor} scale={scale} brightness={brightness} profile={profile} />}
      <SignatureDetails preset={profile.preset} scale={scale} brightness={brightness} />
      {site.favorite && (
        <mesh rotation={[profile.ringTilt, profile.tilt, 0]} scale={scale * 1.55}>
          <torusGeometry args={[1.05, 0.08, 12, 72]} />
          <meshBasicMaterial color="#f4d58b" transparent opacity={0.72} />
        </mesh>
      )}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={scale * 1.8}>
          <ringGeometry args={[1.05, 1.12, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
        </mesh>
      )}
      {(selected || hovered || site.favorite || site.visitCount >= 50) && <Billboard position={[0, scale + 0.48, 0]}>
        <Text fontSize={0.28} color={selected ? '#ffffff' : '#aeb8d3'} anchorX="center" anchorY="middle">
          {site.name}
        </Text>
      </Billboard>}
    </group>
  )
})

function BodyMesh({ color, profile, brightness, isPlanet, scale, segments }: { color: string; profile: CelestialVisualProfile; brightness: number; isPlanet: boolean; scale: number; segments: number }) {
  return <mesh scale={[scale * (1 + profile.stretch), scale * (1 - Math.abs(profile.stretch) * 0.45), scale * (1 - profile.stretch * 0.35)]} rotation={[profile.tilt, 0, profile.tilt * 0.35]} frustumCulled>
    <sphereGeometry args={[1, segments, segments]} />
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={isPlanet ? brightness * 0.45 : brightness * 1.8}
      roughness={isPlanet ? 0.72 : 0.25}
      metalness={isPlanet ? 0.05 : 0.3}
      transparent
      opacity={Math.max(0.32, brightness)}
    />
  </mesh>
}

function StarEffects({ color, scale, brightness, bright, variant }: { color: string; scale: number; brightness: number; bright: boolean; variant: number }) {
  return <group scale={scale}>
    <mesh scale={bright ? 1.48 : 1.28}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={color} transparent opacity={(bright ? 0.16 : 0.08) * brightness} side={BackSide} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
    <Billboard>
      <mesh rotation={[0, 0, variant * 0.31]}>
        <boxGeometry args={[bright ? 3.3 : 2.2, bright ? 0.045 : 0.025, 0.01]} />
        <meshBasicMaterial color={color} transparent opacity={(bright ? 0.5 : 0.22) * brightness} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2 + variant * 0.31]}>
        <boxGeometry args={[bright ? 2.5 : 1.55, bright ? 0.04 : 0.02, 0.01]} />
        <meshBasicMaterial color={color} transparent opacity={(bright ? 0.42 : 0.18) * brightness} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      {bright && <mesh rotation={[0, 0, Math.PI / 4 + variant * 0.2]}>
        <boxGeometry args={[2.1, 0.025, 0.01]} />
        <meshBasicMaterial color={color} transparent opacity={0.28 * brightness} blending={AdditiveBlending} depthWrite={false} />
      </mesh>}
    </Billboard>
  </group>
}

function PlanetDetails({ color, scale, brightness, profile }: { color: string; scale: number; brightness: number; profile: CelestialVisualProfile }) {
  return <group scale={scale} rotation={[profile.tilt, 0, profile.tilt * 0.35]}>
    <mesh scale={1.06}>
      <sphereGeometry args={[1, 20, 14]} />
      <meshBasicMaterial color={color} transparent opacity={0.09 * brightness} side={BackSide} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
    {Array.from({ length: profile.bandCount }, (_, index) => {
      const y = (index - (profile.bandCount - 1) / 2) * 0.32
      const radius = Math.sqrt(1 - Math.min(0.8, y * y)) * 1.01
      return <mesh key={index} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.018 + (profile.variant % 2) * 0.008, 6, 40]} />
        <meshBasicMaterial color={index % 2 ? '#ffffff' : color} transparent opacity={(0.16 + index * 0.025) * brightness} />
      </mesh>
    })}
    {Array.from({ length: profile.satelliteCount }, (_, index) => {
      const angle = profile.variant * 1.1 + index * Math.PI
      const distance = 1.65 + index * 0.32
      return <mesh key={`moon-${index}`} position={[Math.cos(angle) * distance, (index - 0.5) * 0.35, Math.sin(angle) * distance]}>
        <sphereGeometry args={[0.12 - index * 0.015, 10, 8]} />
        <meshStandardMaterial color="#b8bfd0" roughness={0.9} />
      </mesh>
    })}
  </group>
}

function SignatureDetails({ preset, scale, brightness }: { preset: CelestialVisualProfile['preset']; scale: number; brightness: number }) {
  if (preset === 'default') return null
  if (preset === 'google') return <group scale={scale * 1.09}>
    {['#4285f4', '#ea4335', '#fbbc05', '#34a853'].map((color, index) => <mesh key={color} rotation={[Math.PI / 2 + index * 0.34, index * 0.72, 0]}>
      <torusGeometry args={[1.03, 0.026, 6, 48]} /><meshBasicMaterial color={color} transparent opacity={0.72 * brightness} />
    </mesh>)}
  </group>
  if (preset === 'youtube') return <group scale={scale * 1.08}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.02, 0.045, 8, 48]} /><meshBasicMaterial color="#ff002f" transparent opacity={0.8 * brightness} /></mesh>
    <mesh position={[0, 0, 1.02]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.22, 0.34, 3]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.9 * brightness} /></mesh>
  </group>
  if (preset === 'github') return <group scale={scale * 1.05}>
    <mesh rotation={[0.4, 0.7, 0]}><icosahedronGeometry args={[1.03, 1]} /><meshBasicMaterial color="#dce4f2" wireframe transparent opacity={0.28 * brightness} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.15, 0.018, 5, 32]} /><meshBasicMaterial color="#8fa3c1" transparent opacity={0.45 * brightness} /></mesh>
  </group>
  if (preset === 'netflix') return <group scale={scale * 1.06}>
    {[0, 1, 2].map((index) => <mesh key={index} rotation={[Math.PI / 2 + index * 0.44, index * 0.55, 0]}><torusGeometry args={[1.02, 0.024 + index * 0.008, 5, 40]} /><meshBasicMaterial color={index === 1 ? '#ff3655' : '#c4112f'} transparent opacity={(0.62 + index * 0.1) * brightness} /></mesh>)}
  </group>
  if (preset === 'discord') return <group scale={scale}>
    <mesh rotation={[1.05, 0.2, 0]} scale={1.34}><torusGeometry args={[1, 0.035, 7, 52]} /><meshBasicMaterial color="#9d91ff" transparent opacity={0.65 * brightness} /></mesh>
    <mesh rotation={[0.45, 1.1, 0]} scale={1.18}><torusGeometry args={[1, 0.022, 6, 44]} /><meshBasicMaterial color="#64c8ff" transparent opacity={0.5 * brightness} /></mesh>
  </group>
  if (preset === 'figma') return <group scale={scale} position={[0, 0, 0.15]}>
    {['#f24e1e', '#ff7262', '#a259ff', '#1abcfe', '#0acf83'].map((color, index) => <mesh key={color} position={[(index % 2 ? 0.42 : -0.42), 0.72 - Math.floor(index / 2) * 0.7, 0.9]}><sphereGeometry args={[0.16, 10, 8]} /><meshBasicMaterial color={color} transparent opacity={0.9 * brightness} /></mesh>)}
  </group>
  if (preset === 'notion') return <group scale={scale * 1.18} rotation={[0.5, 0.65, 0.2]}>
    <mesh><boxGeometry args={[1.35, 1.35, 1.35]} /><meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.48 * brightness} /></mesh>
  </group>
  if (preset === 'chatgpt') return <group scale={scale * 1.08}>
    {[0, 1, 2].map((index) => <mesh key={index} rotation={[Math.PI / 2, index * Math.PI / 3, index * Math.PI / 3]}><torusGeometry args={[0.76, 0.075, 8, 28]} /><meshBasicMaterial color={index === 1 ? '#b8f1df' : '#52c3a1'} transparent opacity={0.58 * brightness} /></mesh>)}
  </group>
  if (preset === 'claude') return <group scale={scale * 1.08} rotation={[0.35, 0.55, 0.1]}>
    <mesh><octahedronGeometry args={[1.08, 1]} /><meshBasicMaterial color="#f0b08b" wireframe transparent opacity={0.5 * brightness} /></mesh>
    <mesh scale={0.66}><dodecahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#ffd5bb" wireframe transparent opacity={0.32 * brightness} /></mesh>
  </group>
  if (preset === 'gemini') return <Billboard><group scale={scale * 1.2}>
    {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((rotation, index) => <mesh key={rotation} rotation={[0, 0, rotation]}><boxGeometry args={[2.45 - index * 0.22, 0.035, 0.02]} /><meshBasicMaterial color={index % 2 ? '#78b8ff' : '#b58cff'} transparent opacity={0.66 * brightness} blending={AdditiveBlending} /></mesh>)}
  </group></Billboard>
  if (preset === 'stackoverflow') return <group scale={scale * 1.08}>
    {[0, 1, 2, 3].map((index) => <mesh key={index} position={[0, -0.42 + index * 0.25, 0]} rotation={[Math.PI / 2, 0, index * 0.12]}><torusGeometry args={[0.72 + index * 0.1, 0.035, 6, 30]} /><meshBasicMaterial color={index === 3 ? '#fff1db' : '#f39a4a'} transparent opacity={(0.46 + index * 0.08) * brightness} /></mesh>)}
  </group>
  if (preset === 'vercel') return <group scale={scale * 1.15} rotation={[0.2, 0.4, 0]}>
    <mesh><coneGeometry args={[1.1, 1.9, 3]} /><meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.58 * brightness} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.25, 0.02, 5, 30]} /><meshBasicMaterial color="#aab4c8" transparent opacity={0.42 * brightness} /></mesh>
  </group>
  if (preset === 'canva') return <group scale={scale * 1.1}>
    {[0, 1, 2].map((index) => <mesh key={index} rotation={[0.7 + index * 0.42, index * 0.8, 0]}><torusGeometry args={[1.02, 0.045, 7, 46]} /><meshBasicMaterial color={['#35d3ce', '#7d72ef', '#ef74ce'][index]} transparent opacity={0.62 * brightness} /></mesh>)}
  </group>
  if (preset === 'twitch') return <group scale={scale * 1.07} rotation={[0.42, 0.6, 0.12]}>
    <mesh><boxGeometry args={[1.45, 1.45, 1.45]} /><meshBasicMaterial color="#bd9aff" wireframe transparent opacity={0.48 * brightness} /></mesh>
    {[-0.26, 0.26].map((x) => <mesh key={x} position={[x, 0.15, 0.78]}><boxGeometry args={[0.12, 0.38, 0.05]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.82 * brightness} /></mesh>)}
  </group>
  if (preset === 'tiktok') return <group scale={scale * 1.1}>
    <mesh rotation={[0.75, 0.2, 0.45]}><torusGeometry args={[1.02, 0.055, 7, 42]} /><meshBasicMaterial color="#25f4ee" transparent opacity={0.65 * brightness} /></mesh>
    <mesh rotation={[0.75, 0.2, 0.55]} scale={0.9}><torusGeometry args={[1.02, 0.055, 7, 42]} /><meshBasicMaterial color="#fe2c55" transparent opacity={0.65 * brightness} /></mesh>
  </group>
  if (preset === 'instagram') return <group scale={scale * 1.08}>
    {[0, 1, 2].map((index) => <mesh key={index} rotation={[Math.PI / 2 + index * 0.55, index * 0.8, 0]}><torusGeometry args={[1.02, 0.038, 7, 44]} /><meshBasicMaterial color={['#ffbd55', '#f05291', '#9668e8'][index]} transparent opacity={0.64 * brightness} /></mesh>)}
    <mesh position={[0.58, 0.58, 0.72]}><sphereGeometry args={[0.1, 8, 6]} /><meshBasicMaterial color="#ffe2be" /></mesh>
  </group>
  if (preset === 'x') return <Billboard><group scale={scale * 1.04} rotation={[0, 0, 0.18]}>
    {[Math.PI / 4, -Math.PI / 4].map((rotation) => <mesh key={rotation} rotation={[0, 0, rotation]}><boxGeometry args={[2.2, 0.06, 0.04]} /><meshBasicMaterial color="#eef3fa" transparent opacity={0.72 * brightness} /></mesh>)}
  </group></Billboard>
  if (preset === 'linkedin') return <group scale={scale * 1.08}>
    {[-0.72, 0, 0.72].map((x, index) => <mesh key={x} position={[x, (index - 1) * 0.18, 0.75]}><sphereGeometry args={[0.15 + index * 0.035, 10, 8]} /><meshBasicMaterial color={index === 1 ? '#b9e1ff' : '#57a6df'} transparent opacity={0.84 * brightness} /></mesh>)}
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.12, 0.025, 6, 42]} /><meshBasicMaterial color="#5eb5ed" transparent opacity={0.48 * brightness} /></mesh>
  </group>
  if (preset === 'slack') return <group scale={scale * 1.06}>
    {['#36c5f0', '#2eb67d', '#ecb22e', '#e01e5a'].map((color, index) => <mesh key={color} position={[index < 2 ? -0.42 : 0.42, index % 2 ? -0.42 : 0.42, 0.78]} rotation={[0, 0, index * Math.PI / 2]}><capsuleGeometry args={[0.1, 0.5, 5, 10]} /><meshBasicMaterial color={color} transparent opacity={0.88 * brightness} /></mesh>)}
  </group>
  if (preset === 'spotify') return <group scale={scale * 1.06}>
    {[0, 1, 2].map((index) => <mesh key={index} position={[0, 0.36 - index * 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.92 - index * 0.12, 0.035, 6, 38]} /><meshBasicMaterial color="#68ef91" transparent opacity={(0.72 - index * 0.1) * brightness} /></mesh>)}
  </group>
  if (preset === 'amazon') return <group scale={scale * 1.1}>
    <mesh rotation={[1.05, 0.1, -0.35]}><torusGeometry args={[1.08, 0.052, 7, 52]} /><meshBasicMaterial color="#ffb24d" transparent opacity={0.7 * brightness} /></mesh>
    <mesh position={[1.12, -0.35, 0.3]}><coneGeometry args={[0.13, 0.34, 3]} /><meshBasicMaterial color="#ffd28a" /></mesh>
  </group>
  if (preset === 'coupang') return <group scale={scale * 1.08}>
    {['#e94450', '#f49b35', '#48a85b', '#3c86dc', '#8c57c9'].map((color, index) => <mesh key={color} rotation={[Math.PI / 2 + index * 0.23, index * 0.47, 0]}><torusGeometry args={[1.02 + index * 0.025, 0.022, 5, 38]} /><meshBasicMaterial color={color} transparent opacity={0.68 * brightness} /></mesh>)}
  </group>
  if (preset === 'reddit') return <group scale={scale * 1.08}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.03, 0.04, 7, 44]} /><meshBasicMaterial color="#ff754f" transparent opacity={0.72 * brightness} /></mesh>
    {[-0.32, 0.32].map((x) => <mesh key={x} position={[x, 0.05, 0.96]}><sphereGeometry args={[0.1, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>)}
    <mesh position={[0.48, 0.92, 0.25]}><sphereGeometry args={[0.13, 8, 6]} /><meshBasicMaterial color="#ff9a79" /></mesh>
  </group>
  if (preset === 'gitlab') return <group scale={scale * 1.12} rotation={[0.25, 0.35, 0]}>
    {[0, 1, 2].map((index) => <mesh key={index} rotation={[0, index * Math.PI * 2 / 3, 0]} position={[0, 0.12, 0]}><coneGeometry args={[0.42, 1.75, 3]} /><meshBasicMaterial color={['#fc8a45', '#e65132', '#f6b54b'][index]} wireframe transparent opacity={0.62 * brightness} /></mesh>)}
  </group>
  if (preset === 'npm') return <group scale={scale * 1.08} rotation={[0.38, 0.5, 0.08]}>
    <mesh><boxGeometry args={[1.7, 1.05, 1.35]} /><meshBasicMaterial color="#f15b5d" wireframe transparent opacity={0.52 * brightness} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.08, 0.025, 5, 36]} /><meshBasicMaterial color="#ffd1d1" transparent opacity={0.5 * brightness} /></mesh>
  </group>
  if (preset === 'adobe') return <group scale={scale * 1.12}>
    {[-0.45, 0.45].map((x, index) => <mesh key={x} position={[x, 0, 0.72]} rotation={[0, 0, index ? -0.34 : 0.34]}><coneGeometry args={[0.46, 1.55, 3]} /><meshBasicMaterial color={index ? '#ff765f' : '#ff334f'} wireframe transparent opacity={0.65 * brightness} /></mesh>)}
  </group>
  if (preset === 'facebook') return <group scale={scale * 1.08}>
    {[0, 1, 2].map((index) => <mesh key={index} rotation={[Math.PI / 2 + index * 0.48, index * 0.75, 0]}><torusGeometry args={[1.02, 0.035, 6, 42]} /><meshBasicMaterial color={index === 1 ? '#9fc6ff' : '#4c8ceb'} transparent opacity={0.62 * brightness} /></mesh>)}
    <mesh position={[0, 0.25, 1]}><boxGeometry args={[0.12, 0.85, 0.04]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.8 * brightness} /></mesh>
  </group>
  if (preset === 'trello') return <group scale={scale * 1.08} rotation={[0.38, 0.5, 0.05]}>
    {[-0.43, 0, 0.43].map((x, index) => <mesh key={x} position={[x, 0.05 - index * 0.13, 0.82]}><boxGeometry args={[0.28, 1.15 - index * 0.18, 0.12]} /><meshBasicMaterial color={index === 1 ? '#a7d6ff' : '#62a7df'} transparent opacity={0.7 * brightness} /></mesh>)}
  </group>
  if (preset === 'duolingo') return <group scale={scale * 1.08}>
    {[-0.34, 0.34].map((x) => <mesh key={x} position={[x, 0.18, 0.92]}><sphereGeometry args={[0.2, 10, 8]} /><meshBasicMaterial color="#e9ffd9" transparent opacity={0.9 * brightness} /></mesh>)}
    <mesh position={[0, -0.15, 1.02]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.2, 0.36, 3]} /><meshBasicMaterial color="#ffb84e" /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.04, 0.04, 7, 42]} /><meshBasicMaterial color="#8ceb5e" transparent opacity={0.66 * brightness} /></mesh>
  </group>
  if (preset === 'epicgames') return <group scale={scale * 1.12} rotation={[0.45, 0.55, 0.08]}>
    <mesh><dodecahedronGeometry args={[1.08, 0]} /><meshBasicMaterial color="#d7d9e0" wireframe transparent opacity={0.48 * brightness} /></mesh>
    <mesh scale={0.64}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.38 * brightness} /></mesh>
  </group>
  if (preset === 'binance') return <group scale={scale * 1.1} rotation={[0.3, 0.45, 0]}>
    {[0, 1, 2].map((index) => <mesh key={index} rotation={[0, index * Math.PI / 4, index * Math.PI / 4]}><octahedronGeometry args={[1.02 - index * 0.2, 0]} /><meshBasicMaterial color={index === 1 ? '#fff0a1' : '#f2c84b'} wireframe transparent opacity={(0.58 - index * 0.08) * brightness} /></mesh>)}
  </group>
  if (preset === 'steam') return <group scale={scale * 1.12}>
    <mesh rotation={[1.1, 0.4, 0]}><torusGeometry args={[1.08, 0.055, 8, 52]} /><meshStandardMaterial color="#78b9dd" metalness={0.8} roughness={0.24} transparent opacity={0.7 * brightness} /></mesh>
    <mesh position={[1.3, 0.25, 0]}><sphereGeometry args={[0.13, 10, 8]} /><meshBasicMaterial color="#d4efff" /></mesh>
  </group>
  return null
}

function CategoryGuides({ sites, clusters }: { sites: Site[]; clusters: SiteCluster[] }) {
  return <>{Object.entries(CATEGORY_ANCHORS).filter(([name]) => name !== 'Unclassified').map(([name, position]) => {
    const categorySites = sites.filter((site) => site.category === name)
    const hiddenCount = clusters.find((cluster) => cluster.category === name)?.count ?? 0
    const totalCount = categorySites.length + hiddenCount
    const farthestBody = categorySites.reduce((maximum, site) => Math.max(maximum, Math.hypot(
      site.position[0] - position[0], site.position[1] - position[1], site.position[2] - position[2],
    ) + getCelestialScale(site.visitCount)), 0)
    const radius = Math.min(5.5, Math.max(1.8, farthestBody + 0.42, 1.55 + Math.sqrt(totalCount) * 0.34))
    return <group key={name} position={position}>
      <mesh>
        <sphereGeometry args={[radius, 22, 14]} />
        <meshBasicMaterial color="#7783b2" transparent opacity={0.045} wireframe />
      </mesh>
      <Billboard position={[0, radius + 0.25, -0.2]}>
        <Text fontSize={0.18} color="#65708f" letterSpacing={0.12}>{name.toUpperCase()}</Text>
      </Billboard>
    </group>
  })}</>
}

function ClusterMarker({ cluster, onExpand }: { cluster: SiteCluster; onExpand: () => void }) {
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * 0.35) * 0.08
  })
  return <group ref={group} position={cluster.position} onClick={(event) => { event.stopPropagation(); onExpand() }}>
    <mesh>
      <sphereGeometry args={[0.57, 24, 24]} />
      <meshStandardMaterial color={cluster.color} emissive={cluster.color} emissiveIntensity={0.7} transparent opacity={0.24} wireframe />
    </mesh>
    {[0, 1, 2, 3].map((index) => <mesh key={index} position={[Math.cos(index * 1.57) * 0.48, Math.sin(index * 1.57) * 0.48, 0.12]}>
      <sphereGeometry args={[0.1, 12, 12]} /><meshBasicMaterial color={cluster.color} />
    </mesh>)}
    <Billboard position={[0, 0, 0.62]}>
      <Text fontSize={0.28} color="#ffffff" outlineWidth={0.018} outlineColor="#090c19">+{cluster.count}</Text>
    </Billboard>
    <Billboard position={[0, -0.92, 0]}>
      <Text fontSize={0.16} color="#8c97b3">{cluster.category} 펼치기</Text>
    </Billboard>
  </group>
}

function ConstellationLines({ constellations, sites }: { constellations: ConstellationView[]; sites: Site[] }) {
  const positionById = new Map(sites.map((site) => [site.id, site.position]))
  return <group>{constellations.flatMap((constellation) => (constellation.edges ?? []).map((edge, index) => {
    const from = positionById.get(edge.fromSiteId)
    const to = positionById.get(edge.toSiteId)
    if (!from || !to) return null
    const edgeStrength = edge.count >= 10 ? 3 : edge.count >= 5 ? 2 : 1
    return <Line
      key={`${constellation.id}-${index}`}
      points={[from, to]}
      color={edgeStrength >= 3 ? '#d1c4ff' : '#a18bf5'}
      lineWidth={edgeStrength === 1 ? 2.4 : edgeStrength === 2 ? 4.2 : 6.2}
      transparent
      opacity={edgeStrength === 1 ? 0.76 : edgeStrength === 2 ? 0.9 : 1}
      dashed={false}
      dashSize={0.18}
      gapSize={0.12}
    />
  }))}</group>
}

export function UniverseCanvas({ sites, selectedId, onSelect, clusters, onExpandCluster, constellations }: Props) {
  return (
    <Canvas
      className="universe-webgl"
      camera={{ position: [0, 1.5, 13], fov: 48 }}
      dpr={[1, 1.75]}
      gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        const background = new Color('#03050d')
        gl.setClearColor(background, 1)
        scene.background = background
      }}
      style={{ backgroundColor: '#03050d', colorScheme: 'dark' }}
    >
      <fog attach="fog" args={['#050712', 13, 28]} />
      <ambientLight intensity={0.22} />
      <Stars radius={60} depth={35} count={1800} factor={2.2} saturation={0.25} fade speed={0.25} />
      <Sparkles count={80} scale={[18, 12, 8]} size={0.7} speed={0.15} color="#7c8bff" />
      <Sun />
      <CategoryGuides sites={sites} clusters={clusters} />
      <ConstellationLines constellations={constellations} sites={sites} />
      {sites.map((site) => (
        <CelestialBody key={site.id} site={site} selected={selectedId === site.id} onSelect={onSelect} />
      ))}
      {clusters.map((cluster) => <ClusterMarker key={cluster.category} cluster={cluster} onExpand={() => onExpandCluster(cluster.category)} />)}
      <OrbitControls enablePan={false} minDistance={7} maxDistance={22} autoRotate autoRotateSpeed={0.12} />
    </Canvas>
  )
}
