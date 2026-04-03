"use client"

import { useState, useMemo } from "react"
import { Copy, Download, Check, Pencil, Trash2, Plus } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Section {
  id: string
  title: string
  content: string
}

interface ReviewResultProps {
  content: string
}

// 解析审核结果文本，按 Markdown 标题（##）分割
function parseSections(text: string): Section[] {
  const sections: Section[] = []

  // 匹配 ## 标题 格式
  const regex = /^(## \d+\. .+)$/gm
  let match
  let foundAny = false

  // 查找所有 ## 标题
  const matches: { title: string; index: number }[] = []
  while ((match = regex.exec(text)) !== null) {
    matches.push({ title: match[1], index: match.index })
    foundAny = true
  }

  if (!foundAny) {
    // 没有找到 ## 标题格式，尝试按【xxx】分割
    const legacyRegex = /【([^】]+)】/g
    const legacyMatches: { title: string; index: number }[] = []
    while ((match = legacyRegex.exec(text)) !== null) {
      legacyMatches.push({ title: match[1], index: match.index })
    }

    if (legacyMatches.length > 0) {
      // 按【xxx】分割
      legacyMatches.forEach((m, i) => {
        const startIndex = m.index
        const endIndex = i < legacyMatches.length - 1 ? legacyMatches[i + 1].index : text.length
        const content = text.substring(startIndex, endIndex).trim()

        sections.push({
          id: `section-${i}`,
          title: m.title,
          content: content,
        })
      })
      return sections
    }

    // 都没有找到，返回整个内容
    return [{ id: "0", title: "", content: text }]
  }

  // 提取头部内容（第一个 ## 标题之前的内容，包括 # 标题）
  if (matches[0].index > 0) {
    const headerContent = text.substring(0, matches[0].index).trim()
    if (headerContent) {
      sections.push({
        id: "header",
        title: "报告头部",
        content: headerContent,
      })
    }
  }

  // 提取每个区块
  matches.forEach((m, i) => {
    const startIndex = m.index
    const endIndex = i < matches.length - 1 ? matches[i + 1].index : text.length
    const content = text.substring(startIndex, endIndex).trim()

    sections.push({
      id: `section-${i}`,
      title: m.title.replace(/^## /, ""),
      content: content,
    })
  })

  return sections
}

// 将区块合并回文本
function sectionsToText(sections: Section[]): string {
  return sections.map((s) => s.content).join("\n\n")
}

export function ReviewResult({ content: initialContent }: ReviewResultProps) {
  const [sections, setSections] = useState<Section[]>(() => parseSections(initialContent))
  const [copied, setCopied] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newContent, setNewContent] = useState("")

  // 当前完整的审核结果文本
  const currentContent = useMemo(() => sectionsToText(sections), [sections])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("复制失败:", err)
    }
  }

  const handleDownloadPDF = () => {
    const blob = new Blob([currentContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `审核报告_${new Date().toLocaleDateString("zh-CN")}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleEdit = (section: Section) => {
    setEditingId(section.id)
    setEditContent(section.content)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      setSections((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, content: editContent } : s))
      )
      setEditingId(null)
      setEditContent("")
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent("")
  }

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      setSections((prev) => prev.filter((s) => s.id !== deleteTargetId))
    }
    setDeleteDialogOpen(false)
    setDeleteTargetId(null)
  }

  const handleAddNew = () => {
    if (newContent.trim()) {
      const newSection: Section = {
        id: `new-${Date.now()}`,
        title: "",
        content: newContent.trim(),
      }
      setSections((prev) => [...prev, newSection])
      setNewContent("")
      setIsAddingNew(false)
    }
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <CardTitle className="text-lg text-primary">审核结果</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                复制
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            下载
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {sections.map((section) => (
            <div
              key={section.id}
              className="group relative"
            >
              {editingId === section.id ? (
                // 编辑模式
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[150px] font-mono text-sm"
                    placeholder="请输入内容..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      取消
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit}>
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                // 显示模式
                <>
                  {/* 操作按钮 - 悬停显示 */}
                  <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEdit(section)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteClick(section.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* 区块内容 */}
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{section.content}</ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* 添加新内容区域 */}
          {isAddingNew ? (
            <div className="space-y-2 pt-4 border-t">
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
                placeholder="请输入要添加的内容...&#10;&#10;提示：可以使用 ✅ ❌ ⚠️ ➖ 等图标"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddingNew(false)
                    setNewContent("")
                  }}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNew}
                  disabled={!newContent.trim()}
                >
                  添加
                </Button>
              </div>
            </div>
          ) : (
            // 添加按钮
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setIsAddingNew(true)}
              >
                <Plus className="h-4 w-4" />
                添加内容
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个区块吗？删除后将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
