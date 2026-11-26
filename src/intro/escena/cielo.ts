// Cielo de fondo con estrellas titilantes y vía láctea sobre Canvas 2D
interface Estrella {
  x: number
  y: number
  r: number
  alfa: number
  color: string
  titila: number
  fase: number
  cruz: boolean
}

const TONOS = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFE8D6', '#FFE8D6', '#F9BF8F']

export function crearCielo(canvas: HTMLCanvasElement, quieto: boolean): { destruir(): void } {
  const ctxPosible = canvas.getContext('2d')
  if (!ctxPosible) return { destruir() {} }
  const ctx = ctxPosible
  let w = 0, h = 0
  let estrellas: Estrella[] = []
  let raf = 0
  let ultimo = 0
  let vivo = true

  function nueva(x: number, y: number): Estrella {
    const grande = Math.random() < 0.012
    return {
      x,
      y,
      r: grande ? 1.1 + Math.random() * 0.8 : 0.35 + Math.random() ** 2 * 0.75,
      alfa: grande ? 0.95 : 0.15 + Math.random() ** 1.6 * 0.75,
      color: TONOS[(Math.random() * TONOS.length) | 0],
      titila: Math.random() < 0.3 ? 0.5 + Math.random() * 1.6 : 0,
      fase: Math.random() * Math.PI * 2,
      cruz: grande,
    }
  }

  function medir() {
    const r = canvas.getBoundingClientRect()
    w = r.width
    h = r.height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const total = Math.round(Math.min(2600, Math.max(700, (w * h) / 850)))
    estrellas = []
    for (let i = 0; i < total; i++) {
      if (i % 5 < 2) {
        // Franja de la vía láctea en diagonal
        const t = Math.random()
        const x = t * w * 1.2 - w * 0.1
        const centro = h * 0.95 - t * h * 0.9
        const ancho = h * 0.16 * (0.6 + Math.random())
        estrellas.push(nueva(x, centro + (Math.random() + Math.random() - 1) * ancho))
      } else {
        estrellas.push(nueva(Math.random() * w, Math.random() * h))
      }
    }
  }

  function dibujar(ahora: number) {
    ctx.clearRect(0, 0, w, h)
    for (const e of estrellas) {
      const a = e.titila ? e.alfa * (0.6 + 0.4 * Math.sin(ahora * 0.001 * e.titila + e.fase)) : e.alfa
      ctx.globalAlpha = a
      ctx.fillStyle = e.color
      if (e.r < 0.8) {
        ctx.fillRect(e.x, e.y, e.r * 1.6, e.r * 1.6)
      } else {
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (e.cruz) {
        const largo = e.r * 7
        ctx.globalAlpha = a * 0.45
        ctx.fillRect(e.x - largo, e.y - 0.35, largo * 2, 0.7)
        ctx.fillRect(e.x - 0.35, e.y - largo, 0.7, largo * 2)
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 5)
        g.addColorStop(0, 'rgba(255,255,255,0.35)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.globalAlpha = a
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r * 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  function cuadro() {
    if (!vivo) return
    raf = requestAnimationFrame(cuadro)
    const ahora = performance.now()
    if (document.hidden || ahora - ultimo < 33) return
    ultimo = ahora
    dibujar(ahora)
  }

  const alCambiarTamano = () => {
    medir()
    if (quieto) dibujar(0)
  }

  medir()
  if (quieto) dibujar(0)
  else raf = requestAnimationFrame(cuadro)
  window.addEventListener('resize', alCambiarTamano)

  return {
    destruir() {
      vivo = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', alCambiarTamano)
    },
  }
}
