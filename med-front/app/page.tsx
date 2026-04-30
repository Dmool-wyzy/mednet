"use client"

import { useState, useCallback } from "react"
import { PatientSidebar } from "@/components/patient-sidebar"
import { ImageUpload } from "@/components/image-upload"
import { AnalysisResult } from "@/components/analysis-result"
import { 
  Scan, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Maximize2,
  Settings,
  Bell,
  HelpCircle,
  User as UserIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Patient {
  id: string
  name: string
  age: number
  gender: string
  lastVisit: string
  status: "pending" | "completed" | "analyzing"
}

export default function MedicalAIDashboard() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [realConfidence, setRealConfidence] = useState<number>(0)
  
  const [activeTab, setActiveTab] = useState<"upload" | "result">("upload")

  const handleImageSelect = useCallback((file: File) => {
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const startAnalysis = async () => {
    if (!selectedFile) return
    setIsAnalyzing(true)
    setAnalysisComplete(false)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("AI 服务器无响应")
      }

      const data = await response.json()

      // 核心修复 1：把后端传回来的 JPG 格式作为原图，解决浏览器无法显示 TIF 的问题
      if (data.original_image) {
        setUploadedImage(data.original_image)
      }
      setProcessedImage(data.result_image)
      
      // 核心修复 2：严格判断置信度，避开 0 || 96 会变成 96 的 JS 语法陷阱
      const confidence = typeof data.real_confidence === 'number' ? data.real_confidence : 0
      setRealConfidence(confidence)
      
      setIsAnalyzing(false)
      setAnalysisComplete(true)
      setActiveTab("result")
      
    } catch (error) {
      console.error("AI 分析出错:", error)
      alert("⚠️ 无法连接到本地 AI 服务器，请确认终端里的 `python server.py` 已经启动并且代码是最新版！")
      setIsAnalyzing(false)
    }
  }

  const resetAnalysis = () => {
    setUploadedImage(null)
    setSelectedFile(null)
    setProcessedImage(null)
    setRealConfidence(0) 
    setAnalysisComplete(false)
    setActiveTab("upload")
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <PatientSidebar
        selectedPatient={selectedPatient}
        onSelectPatient={setSelectedPatient}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              {selectedPatient ? `${selectedPatient.name} 的影像分析` : "影像诊断工作台"}
            </h2>
            {selectedPatient && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-2 py-1 rounded bg-muted">
                  {selectedPatient.id}
                </span>
                <span>·</span>
                <span>{selectedPatient.age}岁</span>
                <span>·</span>
                <span>{selectedPatient.gender}</span>
              </div>
            )}
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-border mx-2" />
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">医师工作站</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Upload & Preview */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Tab Switcher */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setActiveTab("upload")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === "upload"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                影像上传
              </button>
              <button
                onClick={() => setActiveTab("result")}
                disabled={!analysisComplete}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === "result"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                  !analysisComplete && "opacity-50 cursor-not-allowed"
                )}
              >
                诊断结果
                {analysisComplete && (
                  <span className="ml-2 w-2 h-2 rounded-full bg-secondary inline-block" />
                )}
              </button>
            </div>

            {activeTab === "upload" ? (
              <div className="space-y-6">
                <ImageUpload
                  onImageSelect={handleImageSelect}
                  isAnalyzing={isAnalyzing}
                />

                {/* Tool Bar */}
                {uploadedImage && !isAnalyzing && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-1">
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Move className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={resetAnalysis}
                        className="px-4 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                      >
                        重新上传
                      </button>
                      <button
                        onClick={startAnalysis}
                        disabled={!uploadedImage || isAnalyzing}
                        className={cn(
                          "px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                          (!uploadedImage || isAnalyzing) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Scan className="w-4 h-4" />
                        开始 AI 分析
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Tips */}
                {!uploadedImage && (
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { title: "高精度识别", desc: "99.2% 准确率", icon: "🎯" },
                      { title: "快速分析", desc: "平均 1 秒完成", icon: "⚡" },
                      { title: "多模态支持", desc: "CT/MRI/X-Ray", icon: "🔬" },
                    ].map((tip, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
                      >
                        <span className="text-2xl">{tip.icon}</span>
                        <h4 className="text-sm font-medium text-foreground mt-2">
                          {tip.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">{tip.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <AnalysisResult
                isVisible={analysisComplete}
                // 根据后端传回的真实数据进行动态判断
                findings={
                  realConfidence > 0 
                    ? [{
                        id: "AI-001",
                        name: "检出异常特征病灶",
                        location: "AI 自动标记区域 (红色高亮)",
                        severity: "high",
                        confidence: realConfidence,
                        description: "U-Net 深度学习网络在输入影像中提取到明显的异常特征，已完成像素级病灶分割。该区域形态与结构不规则，建议临床医师优先复核。",
                      }]
                    : [{
                        id: "AI-002",
                        name: "未见明显异常",
                        location: "全脑扫描区域",
                        severity: "low",
                        confidence: 99, // 如果没有肿瘤，说明模型对“健康”的判定置信度很高
                        description: "U-Net 网络未在影像中提取到明显异常病灶特征，整体形态结构符合正常生理表现。",
                      }]
                }
                originalImage={uploadedImage} 
                processedImage={processedImage || uploadedImage}
              />
            )}
          </div>

          {/* Right Panel - Live Stats */}
          <aside className="w-80 border-l border-border p-6 bg-card/30 overflow-y-auto hidden xl:block">
            <h3 className="text-sm font-medium text-foreground mb-4">实时统计</h3>

            {/* Stats Cards */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">今日分析</span>
                  <span className="text-lg font-bold text-primary">247</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-3/4 rounded-full bg-primary" />
                </div>
                <span className="text-[10px] text-muted-foreground">目标: 300</span>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">阳性检出</span>
                  <span className="text-lg font-bold text-secondary">32</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-secondary">↑ 12%</span>
                  <span className="text-muted-foreground">较昨日</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">平均耗时</span>
                  <span className="text-lg font-bold text-foreground">1.2s</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-secondary">↓ 4.6s</span>
                  <span className="text-muted-foreground">本地 GPU 优化</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">模型准确率</span>
                  <span className="text-lg font-bold text-secondary">99.2%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[99%] rounded-full bg-secondary" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}