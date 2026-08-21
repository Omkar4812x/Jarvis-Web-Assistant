"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { VoiceOrb } from "./voice-orb"
import { ChatPanel } from "./chat-panel"
import { SciFiHUD } from "./sci-fi-hud"
import { Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { SpeechRecognition, SpeechRecognitionEvent } from "web-speech-api"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: Date
}

function getTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ""
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" && p !== null && "type" in p && p.type === "text" && "text" in p
    )
    .map((p) => p.text)
    .join("")
}

const chatTransport = new DefaultChatTransport({ api: "/api/chat" })

export function JarvisApp() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [textInput, setTextInput] = useState("")
  const [audioLevel, setAudioLevel] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [orbState, setOrbState] = useState<"idle" | "listening" | "processing" | "speaking">("idle")
  const [isVoiceListening, setIsVoiceListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [isSpeaking, setIsSpeaking] = useState(false)
  const lastSpokenRef = useRef("")
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // AI SDK chat - use module-level transport so it never recreates
  const { messages, sendMessage, status } = useChat({ transport: chatTransport })

  const isStreaming = status === "streaming" || status === "submitted"

  // Sync AI messages -> local chatMessages for display
  useEffect(() => {
    console.log('AI SDK messages updated:', messages);
    if (messages.length === 0) return
    const newChatMessages: ChatMessage[] = []
    for (const msg of messages) {
      const text = getTextFromParts(msg.parts)
      if (text) {
        newChatMessages.push({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          text,
          timestamp: new Date(),
        })
      }
    }
    if (newChatMessages.length > 0) {
      setChatMessages(newChatMessages)
    }
  }, [messages])

  // Speak when assistant finishes
  useEffect(() => {
    if (status !== "ready" || messages.length === 0 || !voiceEnabled) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role !== "assistant") return
    const text = getTextFromParts(lastMsg.parts)
    if (text && text !== lastSpokenRef.current) {
      lastSpokenRef.current = text
      speakText(text)
    }
  }, [status, messages, voiceEnabled])

  // Update orb state
  useEffect(() => {
    if (isSpeaking) setOrbState("speaking")
    else if (isVoiceListening) setOrbState("listening")
    else if (isStreaming) setOrbState("processing")
    else setOrbState("idle")
  }, [isSpeaking, isVoiceListening, isStreaming])

  // === Audio level analysis ===
  const stopAudioAnalysis = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = 0
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null
    analyserRef.current = null
    setAudioLevel(0)
  }, [])

  const startAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        setAudioLevel(sum / data.length / 255)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // mic denied
    }
  }, [])

  // === Speech recognition ===
  const stopListening = useCallback(() => {
    const r = recognitionRef.current
    if (r) {
      r.onend = null
      r.onerror = null
      r.onresult = null
      try { r.abort() } catch {}
      recognitionRef.current = null
    }
    setIsVoiceListening(false)
    setInterimTranscript("")
    stopAudioAnalysis()
  }, [stopAudioAnalysis])

  const startListening = useCallback(() => {
    const SR = typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null
    if (!SR) return

    stopListening()

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    let finalText = ""

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += t
        else interim += t
      }
      setInterimTranscript(interim || finalText)
    }

    recognition.onstart = () => {
      setIsVoiceListening(true)
      startAudioAnalysis()
    }

    recognition.onend = () => {
      setIsVoiceListening(false)
      setInterimTranscript("")
      stopAudioAnalysis()
      recognitionRef.current = null
      if (finalText.trim()) {
        sendMessage({ text: finalText.trim() })
      }
    }

    recognition.onerror = () => {
      setIsVoiceListening(false)
      setInterimTranscript("")
      stopAudioAnalysis()
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    try { recognition.start() } catch {}
  }, [sendMessage, startAudioAnalysis, stopAudioAnalysis, stopListening])

  // === Text-to-speech ===
  const speakText = useCallback(async (text: string) => {
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current = null
    }
    if (abortRef.current) abortRef.current.abort()

    setIsSpeaking(true)

    // Try ElevenLabs
    try {
      const controller = new AbortController()
      abortRef.current = controller
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioElRef.current = audio
        audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); audioElRef.current = null }
        audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); audioElRef.current = null }
        await audio.play()
        return
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") { setIsSpeaking(false); return }
    }

    // Fallback: browser speech synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1
      u.pitch = 0.9
      u.onend = () => setIsSpeaking(false)
      u.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(u)
    } else {
      setIsSpeaking(false)
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    abortRef.current?.abort()
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  // === Handlers ===
  const handleSend = useCallback(() => {
    const text = textInput.trim()
    if (!text) return
    console.log("[v0] Sending message via text:", text)
    sendMessage({ text })
    setTextInput("")
  }, [textInput, sendMessage])

  const handleMicClick = useCallback(() => {
    if (isVoiceListening) stopListening()
    else startListening()
  }, [isVoiceListening, startListening, stopListening])

  const handleOrbClick = useCallback(() => {
    if (isSpeaking) stopSpeaking()
    else if (isVoiceListening) stopListening()
    else startListening()
  }, [isSpeaking, isVoiceListening, startListening, stopListening, stopSpeaking])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Scan line */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03]" aria-hidden="true">
        <div className="absolute inset-x-0 h-px bg-primary/50 animate-scan-line" />
      </div>

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(190 100% 50% / 0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(190 100% 50% / 0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 h-full flex">
        {/* Left - HUD */}
        <aside className="hidden lg:flex w-60 border-r border-border/40 bg-card/30 backdrop-blur-sm">
          <SciFiHUD />
        </aside>

        {/* Center - Orb */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500/70" />
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
                System Online
              </span>
            </div>
            <button
              onClick={() => {
                setVoiceEnabled(!voiceEnabled)
                if (isSpeaking) stopSpeaking()
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-[10px] tracking-wider uppercase transition-all",
                voiceEnabled
                  ? "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                  : "border-border/50 text-muted-foreground bg-secondary/30 hover:bg-secondary/50"
              )}
              aria-label={voiceEnabled ? "Disable voice output" : "Enable voice output"}
            >
              {voiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              Voice {voiceEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* Orb */}
          <div className="flex flex-col items-center">
            <h1 className="font-mono text-lg tracking-[0.4em] uppercase text-primary/80 mb-8 animate-text-flicker">
              J.A.R.V.I.S.
            </h1>
            <button
              onClick={handleOrbClick}
              className="cursor-pointer focus:outline-none"
              aria-label={
                isSpeaking
                  ? "Click to stop speaking"
                  : isVoiceListening
                    ? "Click to stop listening"
                    : "Click to start voice input"
              }
            >
              <VoiceOrb state={orbState} audioLevel={audioLevel} />
            </button>

            {interimTranscript && (
              <div className="mt-6 px-6 max-w-md text-center">
                <p className="font-mono text-sm text-primary/70 animate-fade-in-up">
                  {`"${interimTranscript}"`}
                </p>
              </div>
            )}
          </div>

          {/* Bottom hint */}
          <div className="absolute bottom-4 inset-x-0 flex justify-center">
            <p className="font-mono text-[10px] text-muted-foreground/40 tracking-wider">
              Click the orb to speak or type in the chat panel
            </p>
          </div>
        </div>

        {/* Right - Chat */}
        <aside className="w-80 lg:w-96 border-l border-border/40 bg-card/30 backdrop-blur-sm">
          <ChatPanel
            messages={chatMessages}
            input={textInput}
            onInputChange={setTextInput}
            onSend={handleSend}
            onMicClick={handleMicClick}
            isListening={isVoiceListening}
            isStreaming={isStreaming}
            onStop={stopSpeaking}
            speechSupported={true}
          />
        </aside>
      </div>
    </main>
  )
}
