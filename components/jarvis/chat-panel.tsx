"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Mic, Send, Square } from "lucide-react"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: Date
}

interface ChatPanelProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onMicClick: () => void
  isListening: boolean
  isStreaming: boolean
  onStop?: () => void
  speechSupported?: boolean
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  onMicClick,
  isListening,
  isStreaming,
  onStop,
  speechSupported = false,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-primary">
          Communication Log
        </h2>
        <div className="ml-auto font-mono text-[10px] text-muted-foreground">
          {messages.length} entries
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        role="log"
        aria-label="Conversation history"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-xs text-muted-foreground/60 tracking-wider">
              Awaiting input...
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "animate-fade-in-up",
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded px-3 py-2",
                msg.role === "user"
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-secondary/50 border border-border/30"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-wider",
                    msg.role === "user" ? "text-primary" : "text-secondary-foreground"
                  )}
                >
                  {msg.role === "user" ? "You" : "Jarvis"}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border/50">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isStreaming && onStop) {
              onStop()
            } else {
              onSend()
            }
          }}
          className="flex items-center gap-2"
        >
          {speechSupported && (
            <button
              type="button"
              onClick={onMicClick}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200",
                isListening
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50"
              )}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            disabled={isStreaming}
          />
          <button
            type="submit"
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200",
              isStreaming
                ? "bg-destructive/20 border-destructive/50 text-destructive hover:bg-destructive/30"
                : input.trim()
                  ? "bg-primary/20 border-primary/50 text-primary hover:bg-primary/30"
                  : "bg-secondary/50 border-border/50 text-muted-foreground"
            )}
            disabled={!input.trim() && !isStreaming}
            aria-label={isStreaming ? "Stop generating" : "Send message"}
          >
            {isStreaming ? <Square className="w-3 h-3" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
