// Motor de áudio — Web Audio API com latência mínima (latencyHint: 'interactive').
// Sons sintetizados em tempo real: nenhum asset para carregar, zero atraso de rede.

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' })
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Navegadores exigem gesto do usuário antes de tocar áudio — chamar no primeiro keystroke.
export function unlock(): void {
  getCtx()
}

// Escala pentatônica de Dó maior, duas oitavas — a melodia progressiva sobe
// uma nota a cada linha correta, criando sensação de construção musical.
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0]

function tone(
  freq: number,
  when: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'triangle',
): void {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(vol, when + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(when)
  osc.stop(when + dur + 0.05)
}

// Nota da melodia ao completar uma linha; `step` = índice da linha na sessão.
export function playLineNote(step: number, volume: number): void {
  const c = getCtx()
  const f = SCALE[step % SCALE.length]
  tone(f, c.currentTime, 0.7, 0.25 * volume)
  tone(f * 2, c.currentTime, 0.35, 0.06 * volume, 'sine')
}

// O "tum" de erro: grave, curto e distinto — sinaliza sem punir.
export function playError(volume: number): void {
  const c = getCtx()
  const t0 = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(160, t0)
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.12)
  gain.gain.setValueAtTime(0.3 * volume, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + 0.2)
}

// Tique sutil por tecla correta (opcional nas configurações).
// A partir de 50 de combo o som muda: mais brilhante e subindo de tom
// conforme o combo cresce, para empolgar o usuário.
export function playKeyTick(volume: number, combo = 0): void {
  const c = getCtx()
  if (combo >= 50) {
    const f = 2200 + Math.min(combo - 50, 150) * 6
    tone(f, c.currentTime, 0.04, 0.05 * volume, 'triangle')
    tone(f * 1.5, c.currentTime, 0.03, 0.025 * volume, 'sine')
  } else {
    tone(1800, c.currentTime, 0.03, 0.04 * volume, 'square')
  }
}

// Fanfarra ao concluir um trecho — arpejo ascendente com nota final longa.
export function playFanfare(volume: number): void {
  const c = getCtx()
  const t0 = c.currentTime
  ;[0, 2, 4, 5, 7].forEach((s, i) => tone(SCALE[s], t0 + i * 0.09, 0.5, 0.2 * volume))
  tone(SCALE[9], t0 + 0.45, 0.9, 0.22 * volume)
}
