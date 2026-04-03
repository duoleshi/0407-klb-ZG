"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  FileText,
  Calendar,
  Folder,
  Download,
  FileDown,
  Trash2,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ReviewResult } from "@/components/review-result"
import { Header, Footer } from "@/components/landing"

interface ReviewRecord {
  id: number
  filename: string
  file_size: number | null
  profession_types: string | null
  document_content: string | null
  review_result: string
  review_conclusion: string | null
  knowledge_file: string | null
  tokens_used: number | null
  created_at: string
}

// 结论颜色映射
const getConclusionColor = (conclusion: string | null) => {
  if (!conclusion) return "text-gray-500 bg-gray-100"
  if (conclusion === "合规") return "text-green-600 bg-green-100"
  if (conclusion === "部分合规") return "text-yellow-600 bg-yellow-100"
  if (conclusion === "不合规") return "text-red-600 bg-red-100"
  return "text-gray-500 bg-gray-100"
}

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// 格式化文件大小
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [record, setRecord] = useState<ReviewRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // 获取记录详情
  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const response = await fetch(`/api/history/${resolvedParams.id}`)
        const data = await response.json()

        if (data.success) {
          setRecord(data.data)
        } else {
          router.push("/history")
        }
      } catch (error) {
        console.error("获取记录失败:", error)
        router.push("/history")
      } finally {
        setLoading(false)
      }
    }

    fetchRecord()
  }, [resolvedParams.id, router])

  // 删除记录
  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/history?id=${record?.id}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (data.success) {
        router.push("/history")
      }
    } catch (error) {
      console.error("删除失败:", error)
    }
  }

  // 导出为文本
  const exportAsText = () => {
    if (!record) return

    const content = `
工程方案智能审核报告
==================

文件名：${record.filename}
专业类型：${record.profession_types ? JSON.parse(record.profession_types).join("、") : "通用工程"}
审核结论：${record.review_conclusion || "待确认"}
审核时间：${formatDate(record.created_at)}
知识库文件：${record.knowledge_file || "-"}

==================
审核报告内容
==================

${record.review_result}
`

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `审核报告_${record.filename.replace(/\.[^/.]+$/, "")}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 导出为 Markdown
  const exportAsMarkdown = () => {
    if (!record) return

    const content = `# 工程方案智能审核报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 文件名 | ${record.filename} |
| 专业类型 | ${record.profession_types ? JSON.parse(record.profession_types).join("、") : "通用工程"} |
| 审核结论 | ${record.review_conclusion || "待确认"} |
| 审核时间 | ${formatDate(record.created_at)} |
| 知识库文件 | ${record.knowledge_file || "-"} |

---

## 审核报告内容

${record.review_result}
`

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `审核报告_${record.filename.replace(/\.[^/.]+$/, "")}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 导出为 HTML（可用于打印/转PDF）
  const exportAsHTML = () => {
    if (!record) return

    const content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>审核报告 - ${record.filename}</title>
  <style>
    body {
      font-family: "Microsoft YaHei", "SimSun", sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.8;
      color: #333;
    }
    h1 {
      text-align: center;
      color: #1a56db;
      border-bottom: 2px solid #1a56db;
      padding-bottom: 10px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .meta-table td {
      padding: 10px;
      border: 1px solid #ddd;
    }
    .meta-table td:first-child {
      width: 120px;
      background: #f5f5f5;
      font-weight: bold;
    }
    .conclusion {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 4px;
      font-weight: bold;
    }
    .conclusion.compliant { background: #d1fae5; color: #059669; }
    .conclusion.partial { background: #fef3c7; color: #d97706; }
    .conclusion.non-compliant { background: #fee2e2; color: #dc2626; }
    .content {
      white-space: pre-wrap;
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    hr {
      margin: 30px 0;
      border: none;
      border-top: 1px solid #ddd;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>工程方案智能审核报告</h1>

  <table class="meta-table">
    <tr><td>文件名</td><td>${record.filename}</td></tr>
    <tr><td>专业类型</td><td>${record.profession_types ? JSON.parse(record.profession_types).join("、") : "通用工程"}</td></tr>
    <tr><td>审核结论</td><td><span class="conclusion ${record.review_conclusion === '合规' ? 'compliant' : record.review_conclusion === '部分合规' ? 'partial' : 'non-compliant'}">${record.review_conclusion || "待确认"}</span></td></tr>
    <tr><td>审核时间</td><td>${formatDate(record.created_at)}</td></tr>
    <tr><td>知识库文件</td><td>${record.knowledge_file || "-"}</td></tr>
  </table>

  <hr>

  <h2>审核报告内容</h2>
  <div class="content">${record.review_result}</div>

  <hr>

  <p style="text-align: center; color: #999; font-size: 12px;">
    本报告由 AI 智能审核系统生成，仅供参考
  </p>
</body>
</html>`

    const blob = new Blob([content], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `审核报告_${record.filename.replace(/\.[^/.]+$/, "")}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8 md:py-12">
          <div className="mx-auto max-w-[800px] px-4 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">加载中...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-8 md:py-12">
          <div className="mx-auto max-w-[800px] px-4 text-center">
            <p className="text-muted-foreground">记录不存在</p>
            <Link href="/history">
              <Button variant="link" className="mt-2">返回历史记录</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-[800px] px-4">
          {/* 返回按钮 */}
          <Link
            href="/history"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回历史记录
          </Link>

        {/* 基本信息 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              审核详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">文件名</span>
                <span className="font-medium">{record.filename}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">文件大小</span>
                <span>{formatFileSize(record.file_size)}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">专业类型</span>
                <span>
                  {record.profession_types
                    ? JSON.parse(record.profession_types).join("、")
                    : "通用工程"}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-muted-foreground w-20 shrink-0">审核结论</span>
                <span className={`inline-block rounded px-3 py-1 text-sm font-medium ${getConclusionColor(record.review_conclusion)}`}>
                  {record.review_conclusion || "待确认"}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">{formatDate(record.created_at)}</span>
              </div>
              <div className="flex items-start gap-3">
                <Folder className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm text-muted-foreground">
                  {record.knowledge_file || "-"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportAsText}>
              <Download className="mr-2 h-4 w-4" />
              导出 TXT
            </Button>
            <Button variant="outline" onClick={exportAsMarkdown}>
              <FileDown className="mr-2 h-4 w-4" />
              导出 MD
            </Button>
            <Button variant="outline" onClick={exportAsHTML}>
              <FileDown className="mr-2 h-4 w-4" />
              导出 HTML
            </Button>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="ml-auto text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Trash2 className="mr-2 h-4 w-4" />
                删除记录
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除这条审核记录吗？此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* 审核报告内容 */}
        <Card>
          <CardHeader>
            <CardTitle>审核报告</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewResult content={record.review_result} />
          </CardContent>
        </Card>
      </div>
      </main>
      <Footer />
    </div>
  )
}
