"use client"

import { useState } from "react"
import { User, FileText, Clock, Activity, ChevronRight, Search, Brain } from "lucide-react"
import { cn } from "@/lib/utils"

interface Patient {
  id: string
  name: string
  age: number
  gender: string
  lastVisit: string
  status: "pending" | "completed" | "analyzing"
}

interface ScanRecord {
  id: string
  date: string
  type: string
  result: string
  confidence: number
}

const mockPatients: Patient[] = [
  { id: "P001", name: "张明华", age: 45, gender: "男", lastVisit: "2026-04-28", status: "pending" },
  { id: "P002", name: "李雪梅", age: 62, gender: "女", lastVisit: "2026-04-27", status: "completed" },
  { id: "P003", name: "王建国", age: 38, gender: "男", lastVisit: "2026-04-26", status: "analyzing" },
  { id: "P004", name: "刘芳", age: 55, gender: "女", lastVisit: "2026-04-25", status: "completed" },
]

const mockRecords: ScanRecord[] = [
  { id: "R001", date: "2026-04-28", type: "胸部CT", result: "疑似结节", confidence: 87 },
  { id: "R002", date: "2026-04-15", type: "脑部MRI", result: "正常", confidence: 96 },
  { id: "R003", date: "2026-03-20", type: "腹部CT", result: "正常", confidence: 94 },
]

interface PatientSidebarProps {
  selectedPatient: Patient | null
  onSelectPatient: (patient: Patient) => void
}

export function PatientSidebar({ selectedPatient, onSelectPatient }: PatientSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredPatients = mockPatients.filter(
    (p) => p.name.includes(searchQuery) || p.id.includes(searchQuery)
  )

  const getStatusColor = (status: Patient["status"]) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/20 text-amber-400"
      case "completed":
        return "bg-secondary/20 text-secondary"
      case "analyzing":
        return "bg-primary/20 text-primary"
    }
  }

  const getStatusText = (status: Patient["status"]) => {
    switch (status) {
      case "pending":
        return "待诊断"
      case "completed":
        return "已完成"
      case "analyzing":
        return "分析中"
    }
  }

  return (
    <aside className="w-80 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo & Header */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">MedVision AI</h1>
            <p className="text-xs text-muted-foreground">智能影像诊断系统</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索患者姓名或ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-input border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex items-center gap-2 px-2 py-3">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            患者列表
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{filteredPatients.length}</span>
        </div>

        <div className="space-y-1">
          {filteredPatients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => onSelectPatient(patient)}
              className={cn(
                "w-full p-3 rounded-lg text-left transition-all duration-200 group",
                selectedPatient?.id === patient.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50 border border-transparent"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sidebar-foreground">{patient.name}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        getStatusColor(patient.status)
                      )}
                    >
                      {getStatusText(patient.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {patient.id} · {patient.age}岁 · {patient.gender}
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-all",
                    selectedPatient?.id === patient.id
                      ? "text-primary translate-x-0"
                      : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                  )}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Patient Details */}
      {selectedPatient && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              历史记录
            </span>
          </div>

          <div className="space-y-2">
            {mockRecords.map((record) => (
              <div
                key={record.id}
                className="p-2.5 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-sidebar-foreground">{record.type}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      record.result === "正常" ? "text-secondary" : "text-amber-400"
                    )}
                  >
                    {record.result}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{record.date}</span>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary">{record.confidence}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Status */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs text-muted-foreground">系统在线 · AI模型 v3.2.1</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleString("zh-CN")}
          </span>
        </div>
      </div>
    </aside>
  )
}
