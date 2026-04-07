import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { parseUploadedFile, ProgressCallback } from "@/lib/pdf-parser"
import {
  extractKnowledgeContext,
  getKnowledgeBaseInfo,
  ProfessionType,
  shouldUseChunkedReview,
  splitDocumentBySections,
  extractSimplifiedKnowledgeContext,
  identifyProfessionTypes,
  CHUNK_CONFIG,
} from "@/lib/knowledge-base"
import {
  saveReviewRecord,
  extractConclusion,
} from "@/lib/db"
import { getCurrentUserId } from "@/lib/supabase/server"

// 初始化 DeepSeek 客户端
const deepseekClient = new OpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
})

// 初始化千问百炼客户端
const qwenClient = new OpenAI({
  baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.QWEN_API_KEY,
})

// 根据模型选择获取对应的客户端和模型名
function getModelConfig(model: string) {
  if (model === "qwen") {
    return {
      client: qwenClient,
      modelName: process.env.QWEN_MODEL || "qwen-plus",
    }
  }
  return {
    client: deepseekClient,
    modelName: "deepseek-chat",
  }
}

// SSE 进度事件类型
interface ProgressEvent {
  type?: string
  stage: string
  message: string
  current?: number
  total?: number
  percent?: number
}

// 创建 SSE 编码器
function createSSEEncoder() {
  const encoder = new TextEncoder()
  return {
    encode: (event: ProgressEvent) => {
      return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
    },
    encodeResult: (data: any) => {
      return encoder.encode(`data: ${JSON.stringify({ type: "result", ...data })}\n\n`)
    },
    encodeError: (error: string) => {
      return encoder.encode(`data: ${JSON.stringify({ type: "error", error })}\n\n`)
    },
  }
}

/**
 * 构建审核提示词（硬编码模板，与 md 文件格式一致）
 */
function buildReviewPrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  loadedFilesCount: string,
  knowledgeContext: string,
  documentContent: string
): string {
  return `# 角色定位

你是一位经验丰富的施工方案审核专家，精通建筑施工规范。请根据用户上传的施工方案，对照提供的审核依据进行专业审核。

# 审核依据

以下是与你审核任务相关的知识库内容，请严格按照此依据进行审核：
---
${knowledgeContext.slice(0, 80000)}
---

# 待审核内容
---
${documentContent}
---

# 审核输出格式（必须严格遵守以下格式）

请严格按照以下格式输出审核报告：

# ${filename}方案审核报告

## 1. 基本信息

**工程名称：** ${filename}

**专业类型：** ${professionNames}

**危大工程判定：** 根据方案内容判断是否危大工程（危险性较大工程、超过一定规模的危险性较大工程、一般专项方案）。

**审核依据：** 共加载 ${loadedFilesCount} 个规范文件

---

## 2. 通用性审核

（根据通用法律、法规、标准、规范审核，按1.法律2法规3标准和规范排序依次输出）

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ......

---

## 3. 严重缺陷审核

（根据《住房城乡建设部办公厅关于印发《危险性较大的分部分项工程专项施工方案严重缺陷清单（试行）》的通知》检查是否存在缺漏项，如果存在请列出清单。）

---

## 4. 内容完整性审核

（以《危险性较大的分部分项工程专项施工方案编制指南》（建办质〔2021〕48号）为准审核）

---

## 5. 专业性审核

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ..。。

---

## 6. 审核人员

| 角色 | 签字 | 日期 |
|------|------|------|
| 专业监理工程师 | | |
| 总监理工程师 | | |

---

# 问题分级标准

| 级别 | 定义 |
|-----|------|
| 严重问题 | 违反强制性条文、存在重大安全隐患、关键内容错误 |
| 一般问题 | 不符合一般性要求、表述不规范、内容不完整 |
| 缺失项 | 方案中应包含但未提及的内容 |
| 符合项 | 完全符合规范要求 |

# 强制要求

1. 严格依据提供的知识库内容进行审核，不得引用知识库以外的文件或标准。

2. 每条审核意见必须包含完整的四个要素：
   - 问题描述：清晰描述问题所在
   - 方案对应内容：准确引用方案原文
   - 依据：必须包含规范名称、条款编号、条款原文（三者缺一不可）
   - 整改要求/建议：具体可执行的整改建议

3. 通用性审核按法律→法规→标准规范的顺序输出。

4. 整改建议必须具体可执行，不得使用"建议完善"、"建议补充"等模糊表述。

5. 语言风格：专业、客观、准确。

6. 【禁止事项】以下行为严格禁止：
   - 禁止编造知识库中不存在的规范文件名称或编号
   - 禁止编造规范中不存在的条款号
   - 禁止修改、增减条款原文内容（如原文是"75°"不得写成"75°±5°"）
   - 禁止引用不提供条款原文的依据
   - 如无法在知识库中找到确切依据，宁可不提该问题，也不得编造
`
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

export async function POST(request: NextRequest) {
  // 获取当前用户
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  console.log("=== 开始审核请求 ===")
  console.log("环境检查:", {
    nodeEnv: process.env.NODE_ENV,
    hasApiKey: !!process.env.DEEPSEEK_API_KEY,
    cwd: process.cwd(),
  })

  const encoder = createSSEEncoder()
  let abortController = new AbortController()

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode({ type: "progress", ...event }))
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      const sendResult = (data: any) => {
        try {
          controller.enqueue(encoder.encodeResult(data))
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      const sendError = (error: string) => {
        try {
          controller.enqueue(encoder.encodeError(error))
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      const close = () => {
        try {
          controller.close()
        } catch (e) {
          // 流已关闭，忽略
        }
      }

      try {
        // 解析表单数据
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const modelParam = (formData.get("model") as string) || "deepseek"

        if (!file) {
          sendError("请上传文件")
          close()
          return
        }

        const { client, modelName } = getModelConfig(modelParam)
        console.log(`使用模型: ${modelParam} (${modelName})`)

        console.log(`开始审核: ${file.name}, 文件大小: ${file.size} bytes`)

        // 1. 解析上传的文件
        sendProgress({ stage: "file_parse", message: "正在解析文件...", percent: 5 })
        const fileBuffer = Buffer.from(await file.arrayBuffer())

        // 创建进度回调
        const onParseProgress: ProgressCallback = (progress) => {
          sendProgress({
            stage: progress.stage,
            message: progress.message,
            current: progress.current,
            total: progress.total,
            percent: progress.percent ? Math.min(95, 5 + progress.percent * 0.9) : undefined,
          })
        }

        let documentContent: string
        try {
          documentContent = await parseUploadedFile(fileBuffer, file.name, onParseProgress)
          console.log(`文件解析成功: ${documentContent.length} 字符`)
        } catch (parseError) {
          console.error("文件解析失败:", parseError)
          sendError(`文件解析失败: ${parseError instanceof Error ? parseError.message : "未知错误"}`)
          close()
          return
        }

        if (!documentContent || documentContent.length < 100) {
          sendError("文件内容为空或太短，无法审核")
          close()
          return
        }

        // 2. 检测是否需要分块审核
        const chunkCheck = shouldUseChunkedReview(documentContent, file.size)
        console.log(`分块检测: ${chunkCheck.reason}`)

        if (chunkCheck.needsChunking) {
          // 分块审核流程
          await handleChunkedReviewSSE(file, documentContent, client, modelName, sendProgress, sendResult, sendError, close)
          return
        }

        // 3. 提取知识库相关内容
        sendProgress({ stage: "knowledge_load", message: "正在匹配知识库...", percent: 96 })
        console.log("步骤 2: 智能匹配知识库...")
        const { professionTypes, contextContent, loadedFiles } = await extractKnowledgeContext(documentContent)

        const professionNames = professionTypes.length > 0
          ? professionTypes.map(p => p.name).join("、")
          : "通用工程"

        console.log(`识别到的专业类型: ${professionNames}`)
        console.log(`加载的规范文件: ${loadedFiles.length} 个`)

        // 4. 获取知识库信息
        const knowledgeInfo = await getKnowledgeBaseInfo()

        // 5. 构建提示词
        sendProgress({ stage: "ai_review", message: "正在调用 AI 审核...", percent: 98 })
        const currentDate = new Date().toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })

        const maxDocLength = 30000
        const truncatedDoc = documentContent.length > maxDocLength
          ? documentContent.slice(0, maxDocLength) + "\n\n[文档内容过长，已截断...]"
          : documentContent

        const prompt = buildReviewPrompt(
          file.name,
          professionNames,
          currentDate,
          loadedFiles.length.toString(),
          contextContent,
          truncatedDoc
        )

        // 6. 调用 AI API
        console.log("步骤 4: 调用 AI API...")
        const completion = await client.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: "system",
              content: `你是一位专业的施工方案审核专家。你的任务是：
1. 严格按照提供的知识库内容进行审核
2. 使用表格化格式输出审核报告
3. 每个问题都要给出具体依据和整改建议
4. 对于缺失内容要明确标注
5. 保持专业、客观的审核风格`,
            },
            { role: "user", content: prompt },
          ],
          stream: false,
          temperature: 0.2,
          max_tokens: 8000,
        })

        console.log("API 调用完成")
        const reviewResult = completion.choices[0]?.message?.content

        if (!reviewResult) {
          throw new Error("API 返回结果为空")
        }

        // 7. 提取审核结论并保存
        const reviewConclusion = extractConclusion(reviewResult)

        try {
          await saveReviewRecord({
            filename: file.name,
            file_size: file.size,
            profession_types: professionTypes.length > 0 ? professionTypes.map(p => p.name) : [professionNames],
            document_content: documentContent.slice(0, 10000),
            review_result: reviewResult,
            review_conclusion: reviewConclusion,
            knowledge_file: `共加载 ${loadedFiles.length} 个规范文件`,
            tokens_used: completion.usage?.total_tokens,
            model: modelName,
            userId,
          })
        } catch (dbError) {
          console.error("保存审核记录失败:", dbError)
        }

        // 8. 返回结果
        sendProgress({ stage: "complete", message: "审核完成", percent: 100 })
        sendResult({
          success: true,
          result: reviewResult,
          conclusion: reviewConclusion,
          metadata: {
            filename: file.name,
            professionTypes: professionTypes.length > 0 ? professionTypes.map(p => p.name) : [professionNames],
            loadedFiles,
            knowledgeFileCount: knowledgeInfo.fileCount,
            documentLength: documentContent.length,
            tokensUsed: completion.usage?.total_tokens,
          },
        })
        close()
      } catch (error) {
        console.error("审核失败:", error)
        sendError(`审核失败: ${error instanceof Error ? error.message : "未知错误"}`)
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 分块审核相关函数
// ═══════════════════════════════════════════════════════════════════════════

// 分块审核提示词模板 - 比正常审核更简洁
const CHUNK_REVIEW_PROMPT_TEMPLATE = `# 角色定位

你是一位施工方案审核专家。请对以下文档片段进行审核。

# 审核依据（精简版）
---
{knowledgeContext}
---

# 待审核内容 - {chapterTitle}
---
{documentContent}
---

# 审核要求

1. 仅审核本片段内容，重点关注：
   - 技术方案是否合理
   - 参数设置是否符合规范
   - 是否存在明显问题

2. 输出格式：
   ## 审核意见

   ### 意见1
   - **【问题描述】** （填写具体问题）
   - **【方案对应内容】** （引用方案原文）
   - **【依据】** （引用相关规范条款原文）
   - **【整改要求/建议】** （填写具体整改建议）

3. 如果本片段内容完整、符合规范，请直接说明"本片段内容符合规范要求"。

4. 不要输出整体报告格式，只输出针对本片段的审核意见。
`

/**
 * 构建分块审核汇总提示词（硬编码模板，与 md 文件格式一致）
 */
function buildMergePrompt(
  filename: string,
  professionNames: string,
  currentDate: string,
  chunkCount: string,
  loadedFiles: string[],
  chunkReports: string
): string {
  return `# 任务

你是一位施工方案审核专家。现在需要将以下多份分块审核报告合并成一份完整、专业的审核报告。

# 分块审核报告
---
${chunkReports}
---

# 合并要求

1. **去重**：合并相同或相似的审核意见
2. **归类**：按以下结构整理
   - 通用性审核（法律、法规、标准规范）
   - 严重缺陷审核
   - 内容完整性审核
   - 专业性审核

3. **输出格式**：严格按以下格式输出

# ${filename}方案审核报告

## 1. 基本信息

**工程名称：** ${filename}

**专业类型：** ${professionNames}

**危大工程判定：** 根据方案内容判断是否危大工程（危险性较大工程、超过一定规模的危险性较大工程、一般专项方案）。

**审核依据：** 共加载 ${loadedFiles.length} 个规范文件，分别为：
${loadedFiles.map((f, i) => `${i + 1}. ${f}`).join("\n")}

分块审核共 ${chunkCount} 个块

**审核时间：** ${currentDate}

---

## 2. 通用性审核

（根据通用法律、法规、标准、规范审核，按1.法律2法规3标准和规范排序依次输出）

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ......

---

## 3. 严重缺陷审核

（根据《住房城乡建设部办公厅关于印发《危险性较大的分部分项工程专项施工方案严重缺陷清单（试行）》的通知》检查是否存在缺漏项，如果存在请列出清单。）

---

## 4. 内容完整性审核

（以《危险性较大的分部分项工程专项施工方案编制指南》（建办质〔2021〕48号）为准审核）

---

## 5. 专业性审核

**审核意见1：**

- **【问题描述】** （填写具体问题）
- **【方案对应内容】** （引用方案原文）
- **【依据】**
  - 规范名称：（《XXXX规范》GB/JGJ XXXX-XXXX）
  - 条款编号：（第X.X.X条）
  - 条款原文："（必须完整复制审核依据中的原文，不得编造或修改）"
- **【整改要求/建议】** （填写具体整改建议）

**审核意见2：** ......

**审核意见3：** ......

---

## 6. 审核人员

| 角色 | 签字 | 日期 |
|------|------|------|
| 专业监理工程师 | | |
| 总监理工程师 | | |

4. **语言风格**：专业、客观、准确。

5. 【禁止事项】以下行为严格禁止：
   - 禁止编造知识库中不存在的规范文件名称或编号
   - 禁止编造规范中不存在的条款号
   - 禁止修改、增减条款原文内容（如原文是"75°"不得写成"75°±5°"）
   - 禁止引用不提供条款原文的依据
   - 如无法在知识库中找到确切依据，宁可不提该问题，也不得编造
`
}

/**
 * 分块审核处理函数
 */
async function handleChunkedReview(
  file: File,
  documentContent: string
): Promise<NextResponse> {
  console.log("=== 开始分块审核流程 ===")

  const currentDate = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  try {
    // 1. 识别专业类型（使用完整文档识别）
    const professionTypes = await identifyProfessionTypes(documentContent)
    const professionNames = professionTypes.length > 0
      ? professionTypes.map(p => p.name).join("、")
      : "通用工程"
    console.log(`专业类型: ${professionNames}`)

    // 2. 分割文档
    const chunks = splitDocumentBySections(documentContent)
    console.log(`文档已分割为 ${chunks.length} 个块`)

    // 3. 对每个块进行审核
    const chunkReports: string[] = []
    const allLoadedFiles: string[] = []
    let totalTokens = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`\n--- 审核块 ${i + 1}/${chunks.length}: "${chunk.chapterTitle}" (${chunk.charCount} 字符) ---`)

      // 3.1 提取该块相关的精简知识库
      const { contextContent: simplifiedContext, loadedFiles } =
        await extractSimplifiedKnowledgeContext(chunk.content, professionTypes)

      // 收集所有加载的知识库文件（去重）
      for (const f of loadedFiles) {
        if (!allLoadedFiles.includes(f)) {
          allLoadedFiles.push(f)
        }
      }

      // 3.2 构建提示词
      const prompt = CHUNK_REVIEW_PROMPT_TEMPLATE
        .replace("{knowledgeContext}", simplifiedContext.slice(0, CHUNK_CONFIG.MAX_KNOWLEDGE_PER_CHUNK))
        .replace("{chapterTitle}", chunk.chapterTitle)
        .replace("{documentContent}", chunk.content)

      // 3.3 调用 API
      const { client: chunkClient, modelName: chunkModelName } = getModelConfig("deepseek")
      const completion = await chunkClient.chat.completions.create({
        model: chunkModelName,
        messages: [
          {
            role: "system",
            content: "你是一位专业的施工方案审核专家，请对文档片段进行审核。",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 4000,
      })

      const chunkResult = completion.choices[0]?.message?.content || ""
      totalTokens += completion.usage?.total_tokens || 0

      // 3.4 保存块报告
      chunkReports.push(`## 块 ${i + 1}: ${chunk.chapterTitle}\n\n${chunkResult}`)
      console.log(`块 ${i + 1} 审核完成，Token: ${completion.usage?.total_tokens || "未知"}`)
    }

    // 4. 智能汇总
    console.log("\n=== 开始智能汇总 ===")
    const mergePrompt = buildMergePrompt(
      file.name,
      professionNames,
      currentDate,
      chunks.length.toString(),
      allLoadedFiles,
      chunkReports.join("\n\n---\n\n")
    )

    const mergeCompletion = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "你是一位专业的施工方案审核专家，请将多份分块审核报告合并成一份完整、专业的审核报告。",
        },
        { role: "user", content: mergePrompt },
      ],
      stream: false,
      temperature: 0.2,
      max_tokens: 8000,
    })

    const finalResult = mergeCompletion.choices[0]?.message?.content || ""
    totalTokens += mergeCompletion.usage?.total_tokens || 0

    console.log(`智能汇总完成，总 Token: ${totalTokens}`)

    // 5. 提取审核结论
    const reviewConclusion = extractConclusion(finalResult)

    // 6. 保存审核记录
    try {
      await saveReviewRecord({
        filename: file.name,
        file_size: file.size,
        profession_types: professionTypes.map(p => p.name),
        document_content: documentContent.slice(0, 10000),
        review_result: finalResult,
        review_conclusion: reviewConclusion,
        knowledge_file: `分块审核 ${chunks.length} 个块`,
        tokens_used: totalTokens,
        userId,
      })
      console.log("审核记录已保存")
    } catch (dbError) {
      console.error("保存审核记录失败:", dbError)
    }

    // 7. 返回结果
    return NextResponse.json({
      success: true,
      result: finalResult,
      conclusion: reviewConclusion,
      metadata: {
        filename: file.name,
        professionTypes: professionTypes.map(p => p.name),
        chunkCount: chunks.length,
        documentLength: documentContent.length,
        tokensUsed: totalTokens,
        reviewMode: "chunked",
      },
    })
  } catch (error) {
    console.error("分块审核失败:", error)
    return NextResponse.json(
      { error: `分块审核失败: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    )
  }
}

/**
 * 分块审核处理函数（SSE 版本）
 */
async function handleChunkedReviewSSE(
  file: File,
  documentContent: string,
  client: OpenAI,
  modelName: string,
  sendProgress: (event: ProgressEvent) => void,
  sendResult: (data: any) => void,
  sendError: (error: string) => void,
  close: () => void
): Promise<void> {
  console.log("=== 开始分块审核流程（SSE）===")

  const currentDate = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  try {
    // 1. 识别专业类型
    sendProgress({ stage: "chunk_identify", message: "正在识别专业类型...", percent: 10 })
    const professionTypes = await identifyProfessionTypes(documentContent)
    const professionNames = professionTypes.length > 0
      ? professionTypes.map(p => p.name).join("、")
      : "通用工程"
    console.log(`专业类型: ${professionNames}`)

    // 2. 分割文档
    sendProgress({ stage: "chunk_split", message: "正在分割文档...", percent: 15 })
    const chunks = splitDocumentBySections(documentContent)
    console.log(`文档已分割为 ${chunks.length} 个块`)

    // 3. 对每个块进行审核
    const chunkReports: string[] = []
    const allLoadedFiles: string[] = []
    let totalTokens = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkPercent = 15 + Math.round((i / chunks.length) * 70) // 15% - 85%

      sendProgress({
        stage: "chunk_review",
        message: `正在审核块 ${i + 1}/${chunks.length}: "${chunk.chapterTitle.slice(0, 30)}..."`,
        current: i + 1,
        total: chunks.length,
        percent: chunkPercent,
      })

      console.log(`\n--- 审核块 ${i + 1}/${chunks.length}: "${chunk.chapterTitle}" (${chunk.charCount} 字符) ---`)

      // 提取该块相关的精简知识库
      const { contextContent: simplifiedContext, loadedFiles: chunkLoadedFiles } =
        await extractSimplifiedKnowledgeContext(chunk.content, professionTypes)

      // 收集所有加载的知识库文件（去重）
      for (const f of chunkLoadedFiles) {
        if (!allLoadedFiles.includes(f)) {
          allLoadedFiles.push(f)
        }
      }

      // 构建提示词
      const prompt = CHUNK_REVIEW_PROMPT_TEMPLATE
        .replace("{knowledgeContext}", simplifiedContext.slice(0, CHUNK_CONFIG.MAX_KNOWLEDGE_PER_CHUNK))
        .replace("{chapterTitle}", chunk.chapterTitle)
        .replace("{documentContent}", chunk.content)

      // 调用 API
      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content: `你是一位专业的施工方案审核专家。你的任务是：
1. 严格按照提供的知识库内容进行审核
2. 使用表格化格式输出审核报告
3. 每个问题都要给出具体依据和整改建议
4. 对于缺失内容要明确标注
5. 保持专业、客观的审核风格`,
          },
          { role: "user", content: prompt },
        ],
        stream: false,
        temperature: 0.2,
      })

      const chunkResult = completion.choices[0]?.message?.content || ""
      totalTokens += completion.usage?.total_tokens || 0

      // 保存块报告
      chunkReports.push(`## 块 ${i + 1}: ${chunk.chapterTitle}\n\n${chunkResult}`)
      console.log(`块 ${i + 1} 审核完成，Token: ${completion.usage?.total_tokens || "未知"}`)
    }

    // 4. 智能汇总
    sendProgress({ stage: "chunk_merge", message: "正在汇总审核结果...", percent: 90 })
    console.log("\n=== 开始智能汇总 ===")

    const mergePrompt = buildMergePrompt(
      file.name,
      professionNames,
      currentDate,
      chunks.length.toString(),
      allLoadedFiles,
      chunkReports.join("\n\n---\n\n")
    )

    const mergeCompletion = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "你是一位专业的施工方案审核专家，请将多份分块审核报告合并成一份完整、专业的审核报告。",
        },
        { role: "user", content: mergePrompt },
      ],
      stream: false,
      temperature: 0.2,
      max_tokens: 8000,
    })

    const finalResult = mergeCompletion.choices[0]?.message?.content || ""
    totalTokens += mergeCompletion.usage?.total_tokens || 0

    console.log(`智能汇总完成，总 Token: ${totalTokens}`)

    // 5. 提取审核结论
    const reviewConclusion = extractConclusion(finalResult)

    // 6. 保存审核记录
    try {
      await saveReviewRecord({
        filename: file.name,
        file_size: file.size,
        profession_types: professionTypes.map(p => p.name),
        document_content: documentContent.slice(0, 10000),
        review_result: finalResult,
        review_conclusion: reviewConclusion,
        knowledge_file: `分块审核 ${chunks.length} 个块`,
        tokens_used: totalTokens,
        model: modelName,
        userId,
      })
      console.log("审核记录已保存")
    } catch (dbError) {
      console.error("保存审核记录失败:", dbError)
    }

    // 7. 返回结果
    sendProgress({ stage: "complete", message: "审核完成", percent: 100 })
    sendResult({
      success: true,
      result: finalResult,
      conclusion: reviewConclusion,
      metadata: {
        filename: file.name,
        professionTypes: professionTypes.map(p => p.name),
        chunkCount: chunks.length,
        documentLength: documentContent.length,
        tokensUsed: totalTokens,
        reviewMode: "chunked",
      },
    })
    close()
  } catch (error) {
    console.error("分块审核失败:", error)
    sendError(`分块审核失败: ${error instanceof Error ? error.message : "未知错误"}`)
    close()
  }
}
