import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

interface FileInfo {
  name: string
  path: string
  type: "md"
  size: number
}

interface FileTree {
  name: string
  path: string
  children: FileTree[]
  files: FileInfo[]
}

// 提取文件夹名开头的数字用于排序
function extractLeadingNumber(name: string): number {
  const match = name.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : Infinity
}

// 按数字顺序排序（数字小的在前，没有数字的按字符串排序）
function sortByNumber<T extends { name: string }>(items: T[]): T[] {
  return items.sort((a, b) => {
    const numA = extractLeadingNumber(a.name)
    const numB = extractLeadingNumber(b.name)

    // 如果两个都有数字，按数字排序
    if (numA !== Infinity && numB !== Infinity) {
      return numA - numB
    }

    // 如果只有一个有数字，有数字的排前面
    if (numA !== Infinity) return -1
    if (numB !== Infinity) return 1

    // 都没有数字，按字符串排序
    return a.name.localeCompare(b.name, "zh-CN")
  })
}

function getFileInfo(fullPath: string, relativePath: string): FileInfo {
  const stat = fs.statSync(fullPath)
  return {
    name: path.basename(fullPath),
    path: relativePath,
    type: "md",
    size: stat.size,
  }
}

function scanDirectory(dir: string, basePath: string = ""): FileTree {
  const node: FileTree = {
    name: path.basename(dir),
    path: basePath,
    children: [],
    files: [],
  }

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })
    sortByNumber(items)

    for (const item of items) {
      const fullPath = path.join(dir, item.name)
      const relativePath = basePath ? `${basePath}/${item.name}` : item.name

      if (item.isDirectory()) {
        // 递归扫描子目录
        const childNode = scanDirectory(fullPath, relativePath)
        // 只添加有内容的子目录
        if (childNode.files.length > 0 || childNode.children.length > 0) {
          node.children.push(childNode)
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase()
        if (ext === ".md") {
          node.files.push(getFileInfo(fullPath, relativePath))
        }
      }
    }
  } catch (error) {
    console.error(`读取目录失败: ${dir}`, error)
  }

  return node
}

// 扫描顶层目录，返回每个子目录的树结构
function scanRootDirectory(dir: string): FileTree[] {
  const result: FileTree[] = []

  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })
    sortByNumber(items)

    for (const item of items) {
      if (item.isDirectory()) {
        const fullPath = path.join(dir, item.name)
        const node = scanDirectory(fullPath, item.name)
        // 只添加有内容的目录
        if (node.files.length > 0 || node.children.length > 0) {
          result.push(node)
        }
      }
    }
  } catch (error) {
    console.error(`读取目录失败: ${dir}`, error)
  }

  return result
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get("action")
  const filePath = searchParams.get("path")

  // 法规库专用目录
  const regulationsDir = path.join(process.cwd(), "审核依据 ——法规库专用-已更新")

  if (action === "list") {
    try {
      if (!fs.existsSync(regulationsDir)) {
        return NextResponse.json({
          success: false,
          error: "法规库目录不存在",
        })
      }

      const tree = scanRootDirectory(regulationsDir)
      return NextResponse.json({ success: true, data: tree })
    } catch (error) {
      console.error("获取文件列表失败:", error)
      return NextResponse.json({ success: false, error: "获取文件列表失败" })
    }
  }

  if (action === "read" && filePath) {
    try {
      // 安全检查
      const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "")
      const fullPath = path.join(regulationsDir, normalizedPath)

      if (!fullPath.startsWith(regulationsDir)) {
        return NextResponse.json({ success: false, error: "非法路径" }, { status: 403 })
      }

      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ success: false, error: "文件不存在" }, { status: 404 })
      }

      const ext = path.extname(fullPath).toLowerCase()

      // 只支持读取 MD 文件
      if (ext !== ".md") {
        return NextResponse.json({
          success: false,
          error: "暂只支持查看 MD 格式文件",
        })
      }

      const content = fs.readFileSync(fullPath, "utf-8")
      return NextResponse.json({ success: true, data: content })
    } catch (error) {
      console.error("读取文件失败:", error)
      return NextResponse.json({ success: false, error: "读取文件失败" })
    }
  }

  return NextResponse.json({ success: false, error: "无效操作" }, { status: 400 })
}
