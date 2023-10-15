import { Logger, Random, Session } from 'koishi'
import {} from '@koishijs/canvas'

const logger = new Logger('color-ident')

function randomSign() {
  return Random.int(2) * 2 - 1
}

function to256(scale: number) {
  scale *= 256
  return scale > 255 ? 'ff' : scale < 0 ? '00' : Math.floor(scale).toString(16).padStart(2, '0')
}

function createColor(r: number, g: number, b: number) {
  return `#${to256(r)}${to256(g)}${to256(b)}`
}

function hsv(h: number, s: number = 1, v: number = 1) {
  let c = v * s
  const hh = h / 60
  const m = v - c
  const x = c * (1 - Math.abs(hh % 2 - 1)) + m
  c = c + m
  switch (Math.floor(hh)) {
    case 0: return createColor(c, x, m)
    case 1: return createColor(x, c, m)
    case 2: return createColor(m, c, x)
    case 3: return createColor(m, x, c)
    case 4: return createColor(x, m, c)
    case 5: return createColor(c, m, x)
  }
}

export class ColorBias {
  public size: number
  public line: number
  public row: number
  public base: string
  public biased: string
  public bgColor: string
  public fgColor: string

  constructor(public level: number) {
    this.size = 4 + Math.floor(level / 2)
    this.line = Random.int(this.size)
    this.row = Random.int(this.size)
    const h = Random.real(360)
    const s = Random.real(0.2, 1)
    const v = Random.real(0.2, 1)
    this.base = hsv(h, s, v)
    logger.debug('base = hsv(%d, %d, %d) = %s', h, s, v, this.base)

    const factorH = Math.random() * 0.3 + 0.1
    const residue = 1 - factorH
    const factorS = Math.random() * residue * 0.6 + residue * 0.2
    const factorV = residue - factorS

    const rangeH = 30 * Math.exp(-0.2 * level)
    const rangeS = 0.5 * Math.exp(-0.1 * level)
    const rangeV = 0.2 * Math.exp(-0.1 * level)

    let deltaS = factorS * rangeS
    if (deltaS + s > 1) {
      deltaS *= -1
    } else if (deltaS <= s) {
      deltaS *= randomSign()
    }
    let deltaV = factorV * rangeV
    if (deltaV + v > 1) {
      deltaV *= -1
    } else if (deltaV <= v) {
      deltaV *= randomSign()
    }

    const factor = s + v + deltaS / 2 + deltaV / 2
    const deltaH = factorH * rangeH * randomSign() / factor
    let biasedH = h + deltaH
    if (biasedH < 0) biasedH += 360
    else if (biasedH >= 360) biasedH -= 360

    this.biased = hsv(biasedH, s + deltaS, v + deltaV)
    logger.debug('biased = hsv(%d, %d, %d) = %s', biasedH, s + deltaS, v + deltaV, this.biased)
    const inversed = s < 0.2 && v > 0.8
    this.bgColor = inversed ? '#000000' : '#ffffff'
    this.fgColor = inversed ? '#ffffff' : '#000000'
  }

  async render(session: Session) {
    const scale = 64
    const viewSize = this.size + 1.5
    const el = await session.app.canvas.render(viewSize * scale, viewSize * scale, (ctx) => {
      ctx.fillStyle = this.bgColor
      ctx.fillRect(0, 0, viewSize * scale, viewSize * scale)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '32px sans-serif'
      ctx.fillStyle = this.fgColor
      for (let index = 1; index <= this.size; ++index) {
        ctx.fillText(String(index), (index + 0.5) * scale, 0.7 * scale)
        ctx.fillText(String.fromCharCode(index + 64), 0.7 * scale, (index + 0.5) * scale)
      }

      const markSize = 0.4
      for (let i = 0; i < this.size; i += 1) {
        for (let j = 0; j < this.size; j += 1) {
          const cx = j + 1.5
          const cy = i + 1.5
          const fill = i === this.line && j === this.row ? this.biased : this.base
          ctx.fillStyle = fill
          ctx.beginPath()
          ctx.moveTo((cx - markSize) * scale, (cy - markSize) * scale)
          ctx.lineTo((cx + markSize) * scale, (cy - markSize) * scale)
          ctx.lineTo((cx + markSize) * scale, (cy + markSize) * scale)
          ctx.lineTo((cx - markSize) * scale, (cy + markSize) * scale)
          ctx.closePath()
          ctx.fill()
        }
      }
    })
    return ['请输入与其他色块不同的色块坐标。', el]
  }
}
