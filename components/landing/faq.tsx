"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "支持哪些文件格式？",
    answer:
      "系统支持 PDF 和 DOCX（Word 文档）格式。对于扫描版 PDF，系统会自动进行 OCR 识别。暂不支持旧版 .doc 格式，请转换为 .docx 或 PDF 后上传。",
  },
  {
    question: "审核需要多长时间？",
    answer:
      "审核时间通常在 30-90 秒之间，具体取决于文件大小、方案复杂程度以及当前服务器负载情况。审核过程中请勿关闭或刷新页面。",
  },
  {
    question: "审核失败怎么办？",
    answer:
      "请检查文件格式是否正确、文件是否损坏。如果是扫描版 PDF，请确保扫描清晰。如多次尝试仍失败，请联系技术支持并提供失败的文件名称和错误提示信息。",
  },
  {
    question: "审核报告怎么看？",
    answer:
      "审核报告按章节组织：审核依据、通用性审核、严重缺陷审核、内容完整性审核、专业性审核。建议优先关注「严重缺陷审核」和「专业性审核」中的问题。",
  },
  {
    question: "上传的文件会保存吗？",
    answer:
      "系统仅在审核过程中临时存储文件用于分析，审核完成后文件内容不会被长期保存。系统仅保存审核记录（文件名、审核时间、审核结果），您可随时删除。",
  },
  {
    question: "是否支持批量审核？",
    answer:
      "目前系统暂不支持批量审核，需要逐个文件上传。如有批量审核需求，欢迎向我们反馈，我们会根据需求量考虑后续开发。",
  },
  {
    question: "如何反馈问题或建议？",
    answer:
      "您可以通过邮件联系技术支持。反馈时请尽量提供问题描述、复现步骤和截图，以便我们更快定位问题。",
  },
]

export function FAQ() {
  return (
    <section id="faq" className="py-16 md:py-24 bg-muted/30">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            常见问题
          </h2>
          <p className="mt-3 text-muted-foreground">
            还有其他问题？欢迎联系我们
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border-border/50 bg-card px-6 first:rounded-t-xl last:rounded-b-xl [&:not(:last-child)]:border-b"
            >
              <AccordionTrigger className="text-left font-medium text-foreground hover:text-primary">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
