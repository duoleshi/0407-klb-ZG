import { createClient } from "@supabase/supabase-js"

// Supabase 客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// 审核记录接口
export interface ReviewRecord {
  id: number
  filename: string
  file_size: number | null
  profession_types: string | null
  document_content: string | null
  review_result: string
  review_conclusion: string | null
  knowledge_file: string | null
  tokens_used: number | null
  model: string | null
  created_at: string
}

// 创建审核记录的输入接口
export interface CreateReviewInput {
  filename: string
  file_size?: number
  profession_types?: string[]
  document_content?: string
  review_result: string
  review_conclusion?: string
  knowledge_file?: string
  tokens_used?: number
  model?: string
}

/**
 * 保存审核记录
 */
export async function saveReviewRecord(input: CreateReviewInput): Promise<number> {
  // 先清理旧记录
  await cleanupOldRecords()

  const { data, error } = await supabase
    .from("review_records")
    .insert({
      filename: input.filename,
      file_size: input.file_size || null,
      profession_types: input.profession_types ? JSON.stringify(input.profession_types) : null,
      document_content: input.document_content || null,
      review_result: input.review_result,
      review_conclusion: input.review_conclusion || null,
      knowledge_file: input.knowledge_file || null,
      tokens_used: input.tokens_used || null,
      model: input.model || null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("保存审核记录失败:", error)
    throw new Error("保存审核记录失败: " + error.message)
  }

  return data.id
}

/**
 * 获取审核记录列表（分页）
 */
export async function getReviewRecords(
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    professionType?: string
    keyword?: string
  }
): Promise<{ records: ReviewRecord[]; total: number }> {
  const offset = (page - 1) * pageSize

  // 构建查询
  let query = supabase
    .from("review_records")
    .select("*", { count: "exact" })

  if (filters?.professionType) {
    query = query.like("profession_types", `%"${filters.professionType}"%`)
  }

  if (filters?.keyword) {
    query = query.like("filename", `%${filters.keyword}%`)
  }

  // 获取数据（带分页）
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error("获取审核记录失败:", error)
    return { records: [], total: 0 }
  }

  const records: ReviewRecord[] = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as number,
    filename: row.filename as string,
    file_size: row.file_size as number | null,
    profession_types: row.profession_types as string | null,
    document_content: row.document_content as string | null,
    review_result: row.review_result as string,
    review_conclusion: row.review_conclusion as string | null,
    knowledge_file: row.knowledge_file as string | null,
    tokens_used: row.tokens_used as number | null,
    model: row.model as string | null,
    created_at: row.created_at as string,
  }))

  return { records, total: count || 0 }
}

/**
 * 获取单条审核记录
 */
export async function getReviewRecordById(id: number): Promise<ReviewRecord | null> {
  const { data, error } = await supabase
    .from("review_records")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id as number,
    filename: data.filename as string,
    file_size: data.file_size as number | null,
    profession_types: data.profession_types as string | null,
    document_content: data.document_content as string | null,
    review_result: data.review_result as string,
    review_conclusion: data.review_conclusion as string | null,
    knowledge_file: data.knowledge_file as string | null,
    tokens_used: data.tokens_used as number | null,
    model: data.model as string | null,
    created_at: data.created_at as string,
  }
}

/**
 * 删除审核记录
 */
export async function deleteReviewRecord(id: number): Promise<boolean> {
  const { error } = await supabase
    .from("review_records")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("删除记录失败:", error)
    return false
  }

  return true
}

/**
 * 清理旧记录（保留最新100条，删除30天前的记录）
 */
export async function cleanupOldRecords(): Promise<void> {
  // 获取当前记录数
  const { count } = await supabase
    .from("review_records")
    .select("*", { count: "exact", head: true })

  const currentCount = count || 0

  if (currentCount <= 100) {
    // 删除30天前的记录
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    await supabase
      .from("review_records")
      .delete()
      .lt("created_at", thirtyDaysAgo.toISOString())
  } else {
    // 只保留最新的100条：获取第100条的 id，删除比它旧的
    const { data } = await supabase
      .from("review_records")
      .select("id")
      .order("created_at", { ascending: false })
      .range(99, 99)

    if (data && data.length > 0) {
      const thresholdId = data[0].id
      await supabase
        .from("review_records")
        .delete()
        .lt("id", thresholdId)
    }
  }
}

/**
 * 从审核报告中提取结论
 */
export function extractConclusion(reviewResult: string): string {
  // 查找审核结论部分 - 优先匹配"总体评价：xxx"格式
  const patterns = [
    // 匹配 "总体评价：合规/部分合规/不合规" 格式
    /总体评价[：:\s]*(合规|部分合规|不合规)/i,
    // 匹配 "审核结论：xxx" 后换行的内容
    /【审核结论】\s*\n\s*总体评价[：:\s]*(合规|部分合规|不合规)/i,
    // 匹配带方括号的格式 "总体评价：[合规/部分合规/不合规]"
    /总体评价[：:\s]*\[?(合规|部分合规|不合规)\]?/i,
    // 兼容旧格式
    /审核结论[：:\s]*(合规|部分合规|不合规)/i,
    /结论[：:\s]*(合规|部分合规|不合规)/i,
  ]

  for (const pattern of patterns) {
    const match = reviewResult.match(pattern)
    if (match && match[1]) {
      const conclusion = match[1].trim()
      // 直接返回匹配到的结论
      if (conclusion === "合规" || conclusion === "部分合规" || conclusion === "不合规") {
        return conclusion
      }
    }
  }

  // 如果找不到明确结论，通过内容判断
  if (reviewResult.includes("❌ 严重") || reviewResult.includes("不合规")) {
    return "不合规"
  }
  if (reviewResult.includes("⚠️ 一般") || reviewResult.includes("➖ 缺失") || reviewResult.includes("部分合规")) {
    return "部分合规"
  }
  if (reviewResult.includes("✅ 符合") || reviewResult.includes("合规")) {
    return "合规"
  }

  return "待确认"
}
