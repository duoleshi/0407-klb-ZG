"use client"

import { FileCheck, Shield, FileSearch, Target } from "lucide-react"

const features = [
  {
    icon: FileCheck,
    title: "合规性审核",
    description:
      "自动对比国家标准、行业规范，检查方案是否符合相关法规要求，减少人工查阅时间。",
  },
  {
    icon: Shield,
    title: "安全性评估",
    description:
      "针对临时用电、高处作业等高风险领域，识别潜在安全隐患，提供专业整改建议。",
  },
  {
    icon: FileSearch,
    title: "完整性检查",
    description:
      "检测方案是否包含必要的技术参数、计算书、图纸等关键要素，避免审核疏漏。",
  },
  {
    icon: Target,
    title: "针对性意见",
    description:
      "根据方案类型智能匹配专业知识库，生成具有针对性的审核意见和优化建议。",
  },
]

export function Features() {
  return (
    <section id="features" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            核心功能
          </h2>
          <p className="mt-3 text-muted-foreground">
            基于 AI 技术，为工程方案提供全方位智能审核服务
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
