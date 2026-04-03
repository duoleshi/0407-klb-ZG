"use client"

import { useCallback } from "react"
import { Upload, X, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  file: File | null
  onFileChange: (file: File | null) => void
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function FileUpload({ file, onFileChange }: FileUploadProps) {
  const acceptedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]
  const acceptedExtensions = ".pdf,.doc,.docx"

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile && acceptedTypes.includes(droppedFile.type)) {
        onFileChange(droppedFile)
      }
    },
    [onFileChange]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      onFileChange(selectedFile)
    }
    e.target.value = ""
  }

  const handleRemove = () => {
    onFileChange(null)
  }

  if (file) {
    return (
      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">删除文件</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={cn(
        "relative rounded-lg border-2 border-dashed border-muted-foreground/30",
        "bg-muted/30 transition-all duration-200",
        "hover:border-primary/50 hover:bg-primary/5",
        "cursor-pointer"
      )}
    >
      <input
        type="file"
        accept={acceptedExtensions}
        onChange={handleFileSelect}
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-medium text-foreground">
            拖拽文件到此处，或点击选择文件
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            支持 PDF、DOC、DOCX 格式
          </p>
        </div>
      </div>
    </div>
  )
}
