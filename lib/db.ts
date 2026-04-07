import initSqlJs, { Database, SqlJsStatic } from "sql.js"
import fs from "fs"
import path from "path"

// 数据库文件路径
const DB_PATH = path.join(process.cwd(), "data", "review.db")

// 数据库实例缓存
let dbInstance: Database | null = null
let SQL: SqlJsStatic | null = null

/**
 * 初始化 SQL.js
 */
async function initSqlJsEngine(): Promise<SqlJsStatic> {
  if (SQL) return SQL

  // 在服务端加载 WASM 文件
  const wasmBinary = fs.readFileSync(
    path.join(process.cwd(), "public", "wasm", "sql-wasm.wasm")
  )

  SQL = await initSqlJs({
    wasmBinary,
  })
  return SQL
}

/**
 * 获取数据库实例
 * @param forceReload 是否强制从磁盘重新加载
 */
export async function getDatabase(forceReload: boolean = false): Promise<Database> {
  // 如果强制重新加载，先清空缓存
  if (forceReload && dbInstance) {
    try {
      dbInstance.close()
    } catch (e) {
      // 忽略关闭错误
    }
    dbInstance = null
  }

  if (dbInstance) return dbInstance

  const SQL = await initSqlJsEngine()

  // 确保数据目录存在
  const dataDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // 尝试加载现有数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH)
    dbInstance = new SQL.Database(buffer)
    console.log(`数据库从磁盘加载成功，文件大小: ${buffer.length} bytes`)
    // 数据库迁移：为旧表添加缺失的列
    migrateDatabase(dbInstance)
  } else {
    dbInstance = new SQL.Database()
    // 创建表结构
    createTables(dbInstance)
    saveDatabase()
  }

  console.log("数据库初始化成功")
  return dbInstance
}

/**
 * 保存数据库到文件
 */
export function saveDatabase(): void {
  if (!dbInstance) return

  const data = dbInstance.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

/**
 * 创建表结构
 */
function createTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_size INTEGER,
      profession_types TEXT,
      document_content TEXT,
      review_result TEXT NOT NULL,
      review_conclusion TEXT,
      knowledge_file TEXT,
      tokens_used INTEGER,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON review_records(created_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_profession_types ON review_records(profession_types)`)

  console.log("数据库表创建成功")
}

/**
 * 数据库迁移：为旧表添加缺失的列
 */
function migrateDatabase(db: Database): void {
  try {
    const columns = db.exec("PRAGMA table_info(review_records)")
    const columnNames = columns[0]?.values.map((row) => row[1] as string) || []

    if (!columnNames.includes("model")) {
      db.run("ALTER TABLE review_records ADD COLUMN model TEXT")
      console.log("数据库迁移: 添加 model 列")
    }

    saveDatabase()
  } catch (e) {
    console.error("数据库迁移失败:", e)
  }
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (dbInstance) {
    saveDatabase()
    dbInstance.close()
    dbInstance = null
    console.log("数据库连接已关闭")
  }
}

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
  const db = await getDatabase()

  // 先清理旧记录，避免刚插入的记录被误删
  await cleanupOldRecords()

  db.run(
    `INSERT INTO review_records
     (filename, file_size, profession_types, document_content, review_result, review_conclusion, knowledge_file, tokens_used, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [
      input.filename,
      input.file_size || null,
      input.profession_types ? JSON.stringify(input.profession_types) : null,
      input.document_content || null,
      input.review_result,
      input.review_conclusion || null,
      input.knowledge_file || null,
      input.tokens_used || null,
      input.model || null,
    ]
  )

  saveDatabase()

  // 获取最后插入的 ID - 使用更可靠的方式
  const result = db.exec("SELECT MAX(id) FROM review_records")
  const id = (result[0]?.values[0]?.[0] as number) || 0

  return id
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
  // 强制从磁盘重新加载，确保获取最新数据
  const db = await getDatabase(true)
  const offset = (page - 1) * pageSize

  let whereClause = "1=1"
  const params: (string | number)[] = []

  if (filters?.professionType) {
    whereClause += " AND profession_types LIKE ?"
    params.push(`%"${filters.professionType}"%`)
  }

  if (filters?.keyword) {
    whereClause += " AND filename LIKE ?"
    params.push(`%${filters.keyword}%`)
  }

  // 获取总数
  const countResult = db.exec(`SELECT COUNT(*) FROM review_records WHERE ${whereClause}`, params)
  const total = (countResult[0]?.values[0]?.[0] as number) || 0

  // 获取记录
  const recordsResult = db.exec(
    `SELECT id, filename, file_size, profession_types, document_content, review_result,
            review_conclusion, knowledge_file, tokens_used, model, created_at
     FROM review_records
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const records: ReviewRecord[] = []
  if (recordsResult[0]) {
    for (const row of recordsResult[0].values) {
      records.push({
        id: row[0] as number,
        filename: row[1] as string,
        file_size: row[2] as number | null,
        profession_types: row[3] as string | null,
        document_content: row[4] as string | null,
        review_result: row[5] as string,
        review_conclusion: row[6] as string | null,
        knowledge_file: row[7] as string | null,
        tokens_used: row[8] as number | null,
        model: row[9] as string | null,
        created_at: row[10] as string,
      })
    }
  }

  return { records, total }
}

/**
 * 获取单条审核记录
 */
export async function getReviewRecordById(id: number): Promise<ReviewRecord | null> {
  const db = await getDatabase()

  const result = db.exec(
    `SELECT id, filename, file_size, profession_types, document_content, review_result,
            review_conclusion, knowledge_file, tokens_used, model, created_at
     FROM review_records
     WHERE id = ?`,
    [id]
  )

  if (!result[0] || result[0].values.length === 0) {
    return null
  }

  const row = result[0].values[0]
  return {
    id: row[0] as number,
    filename: row[1] as string,
    file_size: row[2] as number | null,
    profession_types: row[3] as string | null,
    document_content: row[4] as string | null,
    review_result: row[5] as string,
    review_conclusion: row[6] as string | null,
    knowledge_file: row[7] as string | null,
    tokens_used: row[8] as number | null,
    model: row[9] as string | null,
    created_at: row[10] as string,
  }
}

/**
 * 删除审核记录
 */
export async function deleteReviewRecord(id: number): Promise<boolean> {
  const db = await getDatabase()

  db.run("DELETE FROM review_records WHERE id = ?", [id])
  saveDatabase()

  return true
}

/**
 * 清理旧记录（保留最新100条，删除30天前的记录）
 */
export async function cleanupOldRecords(): Promise<void> {
  const db = await getDatabase()

  // 先检查当前记录数
  const countResult = db.exec("SELECT COUNT(*) FROM review_records")
  const currentCount = (countResult[0]?.values[0]?.[0] as number) || 0

  // 如果记录数不超过100条，只删除30天前的记录
  if (currentCount <= 100) {
    db.run(
      "DELETE FROM review_records WHERE created_at < datetime('now', '-30 days', 'localtime')"
    )
  } else {
    // 如果记录数超过100条，只保留最新的100条
    db.run(
      `DELETE FROM review_records
       WHERE id NOT IN (
         SELECT id FROM review_records
         ORDER BY created_at DESC
         LIMIT 100
       )`
    )
  }

  saveDatabase()
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
