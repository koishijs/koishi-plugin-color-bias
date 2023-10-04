import { Context, Random } from 'koishi'
import {} from '@koishijs/canvas'

const MAX_LEVEL = 9

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
  const k = h * 3
  const f = k - Math.floor(k)
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (Math.floor(k >= 0 ? k % 6 : k % 6 + 6)) {
    case 0: return createColor(v, t, p)
    case 1: return createColor(q, v, p)
    case 2: return createColor(p, v, t)
    case 3: return createColor(p, q, v)
    case 4: return createColor(t, p, v)
    case 5: return createColor(v, p, q)
  }
}

class State {
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

    const factorH = Math.random() * 0.3 + 0.1
    const residue = 1 - factorH
    const factorS = Math.random() * residue * 0.6 + residue * 0.2
    const factorV = residue - factorS

    const rangeH = 2 * Math.exp(-0.2716 * level)
    const rangeS = 0.2 * Math.exp(-0.1962 * level)
    const rangeV = 0.2 * Math.exp(-0.1962 * level)

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
    const inversed = s < 0.2 && v > 0.8
    this.bgColor = inversed ? '#000000' : '#ffffff'
    this.fgColor = inversed ? '#ffffff' : '#000000'
  }

  render(ctx: Context) {
    const scale = 64
    const viewSize = this.size + 1.5
    return ctx.canvas.render(viewSize * scale, viewSize * scale, (ctx) => {
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
  }
}

export const name = 'color-bias'
export const using = ['canvas']

export function apply(ctx: Context) {
  const states: Record<string, State> = {}

  ctx.command('color-bias [position]', '色觉敏感度测试')
    .alias('sjcs')
    .alias('色觉测试')
    .option('quit', '-q  停止测试')
    .action(async ({ session, options }, position) => {
      const id = session.channelId

      if (!states[id]) {
        if (position || options.quit) {
          return '没有正在进行的色觉敏感度测试。输入“色觉测试”开始一轮测试。'
        }

        states[id] = new State(0)
        await session.send('测试开始。')
        return await states[id].render(ctx)
      }

      if (options.quit) {
        delete states[id]
        return '测试已停止。'
      }

      const state = states[id]
      if (!position) return '请输入坐标。'

      if (!/^[a-z]\d+$/i.test(position)) {
        return '请输入由字母+数字构成的坐标。'
      }

      const x = position.charCodeAt(0) % 32 - 1
      const y = parseInt(position.slice(1)) - 1
      if (x !== state.line || y !== state.row) {
        return '回答错误。'
      }

      if (state.level === MAX_LEVEL) {
        delete states[id]
        return `恭喜 ${session.username} 成功通关，本次测试结束。`
      }

      states[id] = new State(state.level + 1)
      await session.send(`恭喜 ${session.username} 回答正确，下面进入第 ${state.level + 2} 题。`)
      return await states[id].render(ctx)
    })
}
