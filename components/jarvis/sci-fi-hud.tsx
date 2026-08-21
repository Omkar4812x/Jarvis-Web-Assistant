"use client"

import React from "react"

import { useEffect, useState } from "react"
import { Activity, Cpu, Globe, Radio, Shield, Wifi } from "lucide-react"

function HudCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const corners = {
    tl: "top-0 left-0 border-t border-l rounded-tl",
    tr: "top-0 right-0 border-t border-r rounded-tr",
    bl: "bottom-0 left-0 border-b border-l rounded-bl",
    br: "bottom-0 right-0 border-b border-r rounded-br",
  }

  return (
    <div
      className={`absolute w-6 h-6 border-primary/30 ${corners[position]}`}
      aria-hidden="true"
    />
  )
}

function StatusIndicator({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-primary/60" />
      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="font-mono text-[10px] text-primary ml-auto">
        {value}
      </span>
    </div>
  )
}

export function SciFiHUD() {
  const [time, setTime] = useState("")
  const [date, setDate] = useState("")

  useEffect(() => {
    function updateTime() {
      const now = new Date()
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
      setDate(now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-full flex flex-col" aria-label="System status panel">
      <HudCorner position="tl" />
      <HudCorner position="tr" />
      <HudCorner position="bl" />
      <HudCorner position="br" />

      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs tracking-[0.2em] uppercase text-primary">
            System Status
          </h2>
          <div className="w-2 h-2 rounded-full bg-green-500/80 animate-pulse" />
        </div>
      </div>

      {/* Time Display */}
      <div className="px-4 py-4 border-b border-border/30">
        <div className="font-mono text-2xl text-primary tracking-widest text-center" aria-live="off">
          {time}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground tracking-wider text-center mt-1 uppercase">
          {date}
        </div>
      </div>

      {/* Status Indicators */}
      <div className="px-4 py-3 space-y-2.5 flex-1">
        <StatusIndicator icon={Cpu} label="AI Core" value="Online" />
        <StatusIndicator icon={Globe} label="Search" value="Active" />
        <StatusIndicator icon={Radio} label="Voice" value="Ready" />
        <StatusIndicator icon={Wifi} label="Network" value="Connected" />
        <StatusIndicator icon={Shield} label="Security" value="Enabled" />
        <StatusIndicator icon={Activity} label="Latency" value="< 200ms" />
      </div>

      {/* Version footer */}
      <div className="px-4 py-2 border-t border-border/30">
        <p className="font-mono text-[9px] text-muted-foreground/50 text-center tracking-widest uppercase">
          J.A.R.V.I.S. v1.0.0
        </p>
      </div>
    </div>
  )
}
