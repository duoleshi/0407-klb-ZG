"use client"

import { FileText, Clock, CheckCircle, Shield } from "lucide-react"

const stats = [
  {
    icon: FileText,
    value: "10+",
    label: "支持规范",
    description: "涵盖临电、高支模等多专业",
  },
  {
    icon: Clock,
    value: "30s",
    label: "平均审核时间",
    description: "AI 快速分析生成报告",
  },
  {
    icon: CheckCircle,
    value: "70%",
    label: "准确率",
    description: "基于专业知识库审核",
  },
  {
    icon: Shield,
    value: "100%",
    label: "数据安全",
    description: "本地处理，隐私保护",
  },
]

export function Stats() {
  return (
    <section className="border-y border-border/40 bg-muted/30 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground md:text-3xl">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-foreground">
                {stat.label}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
