"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

type OrbState = "idle" | "listening" | "processing" | "speaking"

interface VoiceOrbProps {
  state: OrbState
  audioLevel?: number
}

export function VoiceOrb({ state, audioLevel = 0 }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const phaseRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 280
    canvas.width = size
    canvas.height = size

    const center = size / 2
    const baseRadius = 70

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, size, size)
      phaseRef.current += 0.02

      const isActive = state === "listening" || state === "speaking"
      const isProcessing = state === "processing"

      // Outer glow rings
      if (isActive || isProcessing) {
        const ringCount = 3
        for (let r = 0; r < ringCount; r++) {
          const ringPhase = phaseRef.current + r * 0.8
          const ringRadius = baseRadius + 20 + r * 18 + Math.sin(ringPhase) * 5
          const ringAlpha = 0.08 - r * 0.02

          ctx.beginPath()
          ctx.arc(center, center, ringRadius, 0, Math.PI * 2)
          ctx.strokeStyle = `hsla(190, 100%, 55%, ${ringAlpha})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Waveform ring when listening/speaking
      if (isActive) {
        const points = 128
        const waveAmplitude = 8 + audioLevel * 25
        ctx.beginPath()
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2
          const wave =
            Math.sin(angle * 6 + phaseRef.current * 3) * waveAmplitude * 0.5 +
            Math.sin(angle * 3 - phaseRef.current * 2) * waveAmplitude * 0.3 +
            Math.sin(angle * 9 + phaseRef.current * 5) * waveAmplitude * 0.2
          const r = baseRadius + 5 + wave
          const x = center + Math.cos(angle) * r
          const y = center + Math.sin(angle) * r
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = "hsla(190, 100%, 55%, 0.6)"
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Processing spinner
      if (isProcessing) {
        const arcLength = Math.PI * 0.8
        const startAngle = phaseRef.current * 3
        ctx.beginPath()
        ctx.arc(center, center, baseRadius + 12, startAngle, startAngle + arcLength)
        ctx.strokeStyle = "hsla(190, 100%, 55%, 0.5)"
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(center, center, baseRadius + 12, startAngle + Math.PI, startAngle + Math.PI + arcLength * 0.6)
        ctx.strokeStyle = "hsla(190, 100%, 55%, 0.3)"
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Main orb gradient
      const gradient = ctx.createRadialGradient(
        center, center, 0,
        center, center, baseRadius
      )

      if (state === "idle") {
        gradient.addColorStop(0, "hsla(190, 60%, 25%, 0.4)")
        gradient.addColorStop(0.7, "hsla(190, 50%, 15%, 0.3)")
        gradient.addColorStop(1, "hsla(190, 40%, 10%, 0.1)")
      } else if (state === "listening") {
        const pulse = 0.4 + audioLevel * 0.3
        gradient.addColorStop(0, `hsla(190, 100%, 55%, ${pulse})`)
        gradient.addColorStop(0.6, `hsla(190, 80%, 35%, ${pulse * 0.6})`)
        gradient.addColorStop(1, "hsla(190, 60%, 20%, 0.1)")
      } else if (state === "processing") {
        const p = 0.3 + Math.sin(phaseRef.current * 2) * 0.1
        gradient.addColorStop(0, `hsla(200, 90%, 45%, ${p})`)
        gradient.addColorStop(0.7, `hsla(210, 70%, 25%, ${p * 0.5})`)
        gradient.addColorStop(1, "hsla(220, 50%, 15%, 0.1)")
      } else {
        const pulse = 0.5 + Math.sin(phaseRef.current * 4) * 0.15
        gradient.addColorStop(0, `hsla(190, 100%, 60%, ${pulse})`)
        gradient.addColorStop(0.5, `hsla(190, 90%, 40%, ${pulse * 0.6})`)
        gradient.addColorStop(1, "hsla(190, 60%, 20%, 0.1)")
      }

      ctx.beginPath()
      ctx.arc(center, center, baseRadius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Inner rim
      ctx.beginPath()
      ctx.arc(center, center, baseRadius, 0, Math.PI * 2)
      const rimAlpha = state === "idle" ? 0.15 : 0.35
      ctx.strokeStyle = `hsla(190, 100%, 55%, ${rimAlpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Center dot
      const dotGradient = ctx.createRadialGradient(center, center, 0, center, center, 4)
      dotGradient.addColorStop(0, "hsla(190, 100%, 80%, 0.8)")
      dotGradient.addColorStop(1, "hsla(190, 100%, 55%, 0)")
      ctx.beginPath()
      ctx.arc(center, center, 4, 0, Math.PI * 2)
      ctx.fillStyle = dotGradient
      ctx.fill()

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [state, audioLevel])

  const stateLabel = {
    idle: "Say \"Jarvis\" to activate",
    listening: "Listening...",
    processing: "Processing...",
    speaking: "Speaking...",
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={cn(
            "w-[280px] h-[280px]",
            state === "idle" && "animate-orb-breathe"
          )}
          aria-hidden="true"
        />
        {/* Pulse rings when active */}
        {(state === "listening" || state === "speaking") && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[140px] h-[140px] rounded-full border border-primary/20 animate-pulse-ring" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[140px] h-[140px] rounded-full border border-primary/10 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <p
          className={cn(
            "font-mono text-sm tracking-wider uppercase transition-colors duration-300",
            state === "idle" && "text-muted-foreground",
            state === "listening" && "text-primary",
            state === "processing" && "text-secondary-foreground",
            state === "speaking" && "text-primary animate-text-flicker"
          )}
          role="status"
          aria-live="polite"
        >
          {stateLabel[state]}
        </p>
      </div>
    </div>
  )
}
