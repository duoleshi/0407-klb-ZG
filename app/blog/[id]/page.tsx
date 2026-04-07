"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { ArrowLeft, Calendar, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header, Footer } from "@/components/landing"

interface Blog {
  id: string
  title: string
  summary: string
  content: string
  author: string
  created_at: string
}

export default function BlogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/blog?id=${resolvedParams.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBlog(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [resolvedParams.id])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="mx-auto max-w-[800px] px-4">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>

          {loading ? (
            <div className="py-20 text-center text-muted-foreground">加载中...</div>
          ) : !blog ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">博客不存在</p>
              <Link href="/">
                <Button variant="link" className="mt-2">返回首页</Button>
              </Link>
            </div>
          ) : (
            <article>
              <h1 className="mb-4 text-2xl font-bold text-foreground md:text-3xl">
                {blog.title}
              </h1>

              <div className="mb-8 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {blog.author}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(blog.created_at)}
                </span>
              </div>

              <div className="prose prose-sm max-w-none dark:prose-invert leading-loose">
                {blog.content.split(/\r?\n/).map((line, i) => {
                  const trimmed = line.trim()
                  if (!trimmed) return <br key={i} />
                  return <p key={i}>{trimmed}</p>
                })}
              </div>
            </article>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
