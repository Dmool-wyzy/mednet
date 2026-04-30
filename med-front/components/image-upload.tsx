"use client"

import { useState, useCallback } from "react"
import { Upload, Image as ImageIcon, X, Loader2, Zap, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  onImageSelect: (file: File) => void
  isAnalyzing: boolean
}

export function ImageUpload({ onImageSelect, isAnalyzing }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [isTiff, setIsTiff] = useState<boolean>(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (e.dataTransfer.files?.[0]) {
        processFile(e.dataTransfer.files[0])
      }
    },
    [onImageSelect]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0])
    }
  }

  const processFile = (file: File) => {
    setFileName(file.name)
    // 判断是否为浏览器无法直接渲染的特殊医疗格式
    const isSpecialFormat = file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff') || file.name.toLowerCase().endsWith('.dcm')
    setIsTiff(isSpecialFormat)

    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    onImageSelect(file)
  }

  const clearImage = () => {
    setPreview(null)
    setFileName("")
    setIsTiff(false)
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Upload className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">影像上传</h2>
            <p className="text-xs text-muted-foreground">支持 DICOM, PNG, JPEG, TIF 格式</p>
          </div>
        </div>
        {preview && !isAnalyzing && (
          <button
            onClick={clearImage}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : preview
              ? "border-border bg-card"
              : "border-border hover:border-primary/50 bg-card/50"
        )}
      >
        {preview ? (
          <div className="relative aspect-[4/3] bg-muted/20 flex flex-col items-center justify-center">
            {/* 核心修复：如果是 TIF 等格式，显示专业图标而不是裂开的图片 */}
            {isTiff ? (
              <div className="flex flex-col items-center text-muted-foreground">
                <FileText className="w-16 h-16 mb-4 text-primary/50" />
                <p className="font-medium text-foreground">专业医疗影像已加载</p>
                <p className="text-xs mt-2 text-center max-w-xs">当前格式需依赖云端/本地算力渲染<br/>请直接点击下方【开始 AI 分析】</p>
              </div>
            ) : (
              <img
                src={preview}
                alt="预览图像"
                className="w-full h-full object-contain bg-black/20"
              />
            )}
            
            {/* Overlay during analysis */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                  <Zap className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">底层算力正在提取特征...</p>
                <p className="text-xs text-muted-foreground mt-1">调用本地模型推理中</p>
              </div>
            )}
            {/* File info overlay */}
            {!isAnalyzing && (
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-white/70" />
                  <span className="text-sm text-white/90 truncate">{fileName}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*,.dcm,.tif,.tiff"
              onChange={handleFileInput}
              className="sr-only"
            />
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium mb-1">拖拽文件至此处或点击上传</p>
              <p className="text-sm text-muted-foreground">
                支持 DICOM、CT、MRI、X-Ray 等医学影像格式
              </p>
            </div>
          </label>
        )}
      </div>
    </div>
  )
}