"use client"

import { useState, useEffect } from "react"
import { Header, Footer } from "@/components/landing"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BookOpen, FileText, ChevronRight, ChevronDown, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"

interface FileInfo {
  name: string
  path: string
  type: "md"
  size: number
}

interface FileTree {
  name: string
  path: string
  children: FileTree[]
  files: FileInfo[]
}

// 格式化文件名（移除扩展名）
function formatName(name: string): string {
  return name.replace(/\.md$/i, "")
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 目录树节点组件
function TreeNode({
  node,
  level = 0,
  onFileClick,
}: {
  node: FileTree
  level?: number
  onFileClick: (file: FileInfo) => void
}) {
  const [expanded, setExpanded] = useState(level < 2)
  const hasContent = node.files.length > 0 || node.children.length > 0

  return (
    <div className={cn(level > 0 && "ml-4")}>
      {/* 目录标题 */}
      <div
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors",
          "hover:bg-muted/50",
          level === 0 && "font-semibold"
        )}
        onClick={() => hasContent && setExpanded(!expanded)}
      >
        {hasContent && (
          <span className="text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        )}
        {!hasContent && <span className="w-4" />}
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="text-foreground">{node.name}</span>
        {node.files.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {node.files.length} 文件
          </span>
        )}
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="mt-1 space-y-1 border-l border-border/50 pl-2 ml-2">
          {/* 文件列表 */}
          {node.files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded px-3 py-2 text-sm cursor-pointer hover:bg-primary/5 group"
              onClick={() => onFileClick(file)}
            >
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-muted-foreground group-hover:text-foreground flex-1">
                {formatName(file.name)}
              </span>
              <span className="text-xs text-muted-foreground/60 shrink-0">
                {formatFileSize(file.size)}
              </span>
            </div>
          ))}

          {/* 子目录 */}
          {node.children.map((child, index) => (
            <TreeNode
              key={index}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RegulationsPage() {
  const [data, setData] = useState<FileTree[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 文件内容查看
  const [viewingFile, setViewingFile] = useState<FileInfo | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [contentLoading, setContentLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // 统计
  const [totalFiles, setTotalFiles] = useState(0)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/regulations?action=list")
        const result = await response.json()

        if (result.success) {
          setData(result.data)
          // 统计文件数
          const countFiles = (nodes: FileTree[]): number => {
            let count = 0
            for (const node of nodes) {
              count += node.files.length
              count += countFiles(node.children)
            }
            return count
          }
          setTotalFiles(countFiles(result.data))
        } else {
          setError(result.error || "获取数据失败")
        }
      } catch (err) {
        setError("网络请求失败")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // 查看文件内容
  const handleFileClick = async (file: FileInfo) => {
    setViewingFile(file)
    setContentLoading(true)
    setDialogOpen(true)
    setFileContent("")

    try {
      const response = await fetch(`/api/regulations?action=read&path=${encodeURIComponent(file.path)}`)
      const result = await response.json()

      if (result.success) {
        setFileContent(result.data)
      } else {
        setFileContent(`加载失败: ${result.error}`)
      }
    } catch (err) {
      setFileContent("网络请求失败")
    } finally {
      setContentLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="mx-auto max-w-4xl px-4">
          {/* Page Header */}
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">法规库</span>
            </div>
            <h1 className="mb-3 text-3xl font-bold text-foreground">
              审核依据规范文档
            </h1>
            <p className="text-muted-foreground">
              系统内置的专业审核依据，点击文件名可查看详细内容
            </p>
          </div>

          {/* Stats */}
          {!loading && !error && totalFiles > 0 && (
            <div className="mb-8 flex justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalFiles}</div>
                <div className="text-sm text-muted-foreground">规范文档</div>
              </div>
            </div>
          )}

          {/* Content */}
          <Card className="border-border/50">
            <CardContent className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-4 text-muted-foreground">加载中...</p>
                </div>
              ) : error ? (
                <div className="py-12 text-center">
                  <p className="text-destructive">{error}</p>
                </div>
              ) : data.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>暂无规范文档</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.map((node, index) => (
                    <TreeNode
                      key={index}
                      node={node}
                      onFileClick={handleFileClick}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Note */}
          <div className="mt-8 rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            <p>点击文件名可查看规范详细内容</p>
          </div>
        </div>
      </main>
      <Footer />

      {/* 文件内容查看弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="truncate">
                {viewingFile ? formatName(viewingFile.name) : ""}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {contentLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{fileContent}</ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
