// Motor de partículas para la escena de login. Canvas 2D sin dependencias.
// Las partículas pasan por tres fases:
// caos (cielo de estrellas flotando) -> isotipo (emblema armado con partículas en el medio)
// -> producto (apertura radial expansiva y revelación del nombre OnlyCars).

export type Fase = 'caos' | 'isotipo' | 'producto'

export interface OpcionesEscena {
  logoUrl: string
  quieto: boolean
  faseFija?: Fase
  onFase: (f: Fase) => void
}

export interface Escena {
  repetir(): void
  destruir(): void
}

const LINEA: [number, Fase][] = [
  [0, 'caos'],
  [900, 'isotipo'],
  [3100, 'producto'],
]

const COLORES = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#F9BF8F', '#F9BF8F', '#F37320']
const COLORES_MARCA = ['#F37320', '#F37320', '#F9BF8F', '#FEF1E9', '#BE4B04']

interface P {
  x: number
  y: number
  vx: number
  vy: number
  tx: number
  ty: number
  conDestino: boolean
  color: string
  marca: string
  tam: number
  fase: number
  suelta: number
}

interface Caja {
  x: number
  y: number
  w: number
  h: number
}

const cajaDe = (w: number, h: number): Caja =>
  w >= 1024
    ? { x: w * 0.3, y: h * 0.24, w: w * 0.4, h: h * 0.52 }
    : { x: w * 0.06, y: h * 0.1, w: w * 0.88, h: Math.min(h * 0.3, w * 0.6) }

export function crearEscena(canvas: HTMLCanvasElement, op: OpcionesEscena): Escena {
  const ctxPosible = canvas.getContext('2d')
  if (!ctxPosible) return { repetir() {}, destruir() {} }
  const ctx = ctxPosible
  let w = 0, h = 0, dpr = 1
  let caja: Caja = { x: 0, y: 0, w: 1, h: 1 }
  let ps: P[] = []
  let isotipo: { x: number; y: number }[] = []
  let inicio = performance.now()
  let fase: Fase | null = null
  let raf = 0
  let vivo = true
  const mouse = { x: -9999, y: -9999, activo: false }
  const ondas: { x: number; y: number; t0: number }[] = []
  let logo: HTMLImageElement | null = null

  function formaIsotipo() {
    if (!logo) return []
    const img = logo
    const esc = 2
    const bw = Math.max(1, Math.round(caja.w * esc))
    const bh = Math.max(1, Math.round(caja.h * esc))
    const off = document.createElement('canvas')
    off.width = bw
    off.height = bh
    const c = off.getContext('2d', { willReadFrequently: true })!
    const proporcion = (img.naturalWidth || 1) / (img.naturalHeight || 1)
    const alto = bh * 0.84
    const ancho = alto * proporcion
    c.drawImage(img, (bw - ancho) / 2, (bh - alto) / 2, ancho, alto)
    const datos = c.getImageData(0, 0, bw, bh).data
    const puntos: { x: number; y: number }[] = []
    const paso = Math.max(2, Math.round(Math.sqrt((bw * bh) / 52000)))
    for (let y = 0; y < bh; y += paso) {
      for (let x = 0; x < bw; x += paso) {
        const i = (y * bw + x) * 4
        if (datos[i + 3] < 120) continue
        puntos.push({
          x: caja.x + (x + (Math.random() - 0.5) * paso) / esc,
          y: caja.y + (y + (Math.random() - 0.5) * paso) / esc,
        })
      }
    }
    return mezclar(puntos)
  }

  function medir() {
    const r = canvas.getBoundingClientRect()
    w = r.width
    h = r.height
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    caja = cajaDe(w, h)
    const cantidad = Math.round(Math.min(4200, Math.max(1200, (w * h) / 330)))
    while (ps.length < cantidad) ps.push(nueva())
    ps.length = cantidad
    isotipo = formaIsotipo()
    if (fase) asignar(fase)
  }

  function nueva(): P {
    return {
      x: Math.random() * (w || 1200),
      y: Math.random() * (h || 800),
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      conDestino: false,
      color: COLORES[(Math.random() * COLORES.length) | 0],
      marca: COLORES_MARCA[(Math.random() * COLORES_MARCA.length) | 0],
      tam: 1.1 + Math.random() * 1.5,
      fase: Math.random() * 6.28,
      suelta: 0,
    }
  }

  function asignar(f: Fase, anterior: Fase | null = null) {
    if (f === 'producto' && anterior === 'isotipo') {
      abrirRadial()
      return
    }
    const forma = f === 'isotipo' ? isotipo : []
    const usar = Math.min(forma.length, Math.round(ps.length * 0.9))
    ps.forEach((p, i) => {
      if (i < usar) {
        p.tx = forma[i].x
        p.ty = forma[i].y
        p.conDestino = true
      } else {
        p.conDestino = false
      }
    })
  }

  function abrirRadial() {
    const cx = caja.x + caja.w / 2
    const cy = caja.y + caja.h / 2
    const ahora = performance.now()
    for (const p of ps) {
      if (!p.conDestino) continue
      const ang = Math.atan2(p.y - cy, p.x - cx) + (Math.random() - 0.5) * 0.25
      const c = Math.cos(ang), s = Math.sin(ang)
      const hastaX = c > 0 ? (w - cx) / c : c < 0 ? -cx / c : Infinity
      const hastaY = s > 0 ? (h - cy) / s : s < 0 ? -cy / s : Infinity
      const d = Math.min(hastaX, hastaY) * (0.15 + 0.85 * Math.sqrt(Math.random()))
      p.tx = cx + c * d
      p.ty = cy + s * d
      p.suelta = ahora + 1100 + Math.random() * 900
    }
  }

  function cambiarFase(f: Fase) {
    if (f === fase) return
    const anterior = fase
    fase = f
    asignar(f, anterior)
    op.onFase(f)
  }

  function cuadro() {
    const ahora = performance.now()
    if (!vivo) return
    raf = requestAnimationFrame(cuadro)
    if (document.hidden) return
    const t = ahora - inicio
    let actual: Fase = 'caos'
    for (const [desde, f] of LINEA) if (t >= desde) actual = f
    cambiarFase(actual)

    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'

    const R = 120
    const radioOnda = (o: { t0: number }) => (ahora - o.t0) * 0.9
    while (ondas.length && radioOnda(ondas[0]) > Math.max(w, h)) ondas.shift()

    const lotes = new Map<string, P[]>()
    for (const p of ps) {
      if (p.suelta && ahora >= p.suelta) {
        p.conDestino = false
        p.suelta = 0
      }
      if (p.conDestino) {
        const k = p.suelta ? 0.03 : 0.045, roce = p.suelta ? 0.82 : 0.8
        p.vx += (p.tx - p.x) * k
        p.vy += (p.ty - p.y) * k
        p.vx *= roce
        p.vy *= roce
      } else {
        const ang = Math.sin(p.y * 0.004 + ahora * 0.0003) * 2 + Math.cos(p.x * 0.003 - ahora * 0.0002)
        p.vx += Math.cos(ang) * 0.05
        p.vy += Math.sin(ang) * 0.05
        p.vx *= 0.95
        p.vy *= 0.95
      }
      if (mouse.activo) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.4
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
        }
      }
      for (const o of ondas) {
        const r = radioOnda(o)
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1
        if (Math.abs(d - r) < 28) {
          const f = 2.2 * (1 - Math.abs(d - r) / 28)
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
        }
      }
      p.x += p.vx
      p.y += p.vy
      if (!p.conDestino) {
        if (p.x < -20) p.x = w + 20
        else if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        else if (p.y > h + 20) p.y = -20
      }
      if (p.conDestino) {
        aLote(lotes, p)
        continue
      }
      ctx.globalAlpha = 0.4
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, p.tam, p.tam)
    }
    dibujarFormas(lotes)

    ctx.globalAlpha = 1
    for (const o of ondas) {
      const r = radioOnda(o)
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.35 - r / 1600)})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(o.x, o.y, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  function dibujarFormas(lotes: Map<string, P[]>) {
    ctx.globalAlpha = 0.95
    for (const [color, lista] of lotes) {
      ctx.fillStyle = color
      ctx.beginPath()
      for (const p of lista) {
        const r = (p.tam + 0.6) / 2
        ctx.moveTo(p.x + r, p.y)
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }

  function aLote(lotes: Map<string, P[]>, p: P) {
    const color = fase === 'isotipo' ? p.marca : p.color
    const lista = lotes.get(color)
    if (lista) lista.push(p)
    else lotes.set(color, [p])
  }

  function dibujarQuieto() {
    const f = op.faseFija ?? 'producto'
    fase = f
    asignar(f)
    op.onFase(f)
    ctx.clearRect(0, 0, w, h)
    const lotes = new Map<string, P[]>()
    for (const p of ps) {
      if (p.conDestino) {
        p.x = p.tx
        p.y = p.ty
        aLote(lotes, p)
        continue
      }
      ctx.globalAlpha = 0.35
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, p.tam, p.tam)
    }
    ctx.globalCompositeOperation = 'lighter'
    dibujarFormas(lotes)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  const alMover = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    mouse.x = e.clientX - r.left
    mouse.y = e.clientY - r.top
    mouse.activo = true
  }
  const alSalir = () => {
    mouse.activo = false
  }
  const alClic = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ondas.push({ x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now() })
  }
  const alCambiarTamano = () => {
    medir()
    if (op.quieto || op.faseFija) dibujarQuieto()
  }

  new Promise<void>((ok) => {
    const img = new Image()
    img.onload = () => {
      logo = img
      ok()
    }
    img.onerror = () => ok()
    img.src = op.logoUrl
  }).then(() => {
    if (!vivo) return
    medir()
    if (op.quieto || op.faseFija) {
      dibujarQuieto()
      return
    }
    inicio = performance.now()
    raf = requestAnimationFrame(cuadro)
  })

  window.addEventListener('resize', alCambiarTamano)
  window.addEventListener('pointermove', alMover)
  document.addEventListener('pointerleave', alSalir)
  canvas.addEventListener('pointerdown', alClic)

  return {
    repetir() {
      if (op.quieto) return
      inicio = performance.now()
      fase = null
      for (const p of ps) {
        p.vx += (Math.random() - 0.5) * 14
        p.vy += (Math.random() - 0.5) * 14
      }
    },
    destruir() {
      vivo = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', alCambiarTamano)
      window.removeEventListener('pointermove', alMover)
      document.removeEventListener('pointerleave', alSalir)
      canvas.removeEventListener('pointerdown', alClic)
    },
  }
}

function mezclar<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
