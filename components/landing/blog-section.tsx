"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { BookOpen, ArrowRight, Calendar, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Blog {
  id: string
  title: string
  summary: string
  content: string
  author: string
  created_at: string
}

export function BlogSection() {
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/blog")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBlogs(data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-2 text-primary">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-medium">最新动态</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            博客文章
          </h2>
          <p className="mt-3 text-muted-foreground">
            了解工程审核领域的最新资讯与技术分享
          </p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="mb-4 h-5 w-3/4 rounded bg-muted" />
                  <div className="mb-2 h-4 w-full rounded bg-muted" />
                  <div className="mb-4 h-4 w-2/3 rounded bg-muted" />
                  <div className="h-4 w-1/3 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogs.map((blog) => (
              <Link key={blog.id} href={`/blog/${blog.id}`}>
                <Card className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-6">
                    <h3 className="mb-3 text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {blog.title}
                    </h3>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                      {blog.summary.replace(/\r\n/g, " ").replace(/\n/g, " ")}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {blog.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(blog.created_at)}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        阅读更多
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
