import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { phone, password } = await request.json()

    if (!phone || !password) {
      return NextResponse.json({ error: "请输入手机号和密码" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少需要6位" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // 使用 Supabase GoTrue REST API 注册，保证密码哈希一致
    const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email: `${phone}@users.app`,
        password,
        data: { phone },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data.msg || data.message || data.error_description || "注册失败"
      if (msg.includes("already been registered") || msg.includes("already registered")) {
        return NextResponse.json({ error: "该手机号已注册" }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "注册成功",
    })
  } catch (error) {
    console.error("注册失败:", error)
    return NextResponse.json({ error: "注册失败，请重试" }, { status: 500 })
  }
}
