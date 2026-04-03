"use client"

import Link from "next/link"
import Image from "next/image"
import { History, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

const navLinks = [
  { label: "功能", href: "/#features" },
  { label: "常见问题", href: "/#faq" },
  { label: "法规库", href: "/regulations" },
]

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-4">

        {/* 左侧：Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 z-10">
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span className="font-semibold text-foreground whitespace-nowrap">重工施工方案AI智能审核系统(自研)</span>
        </Link>

        {/* 中间：导航菜单（绝对定位居中） */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* 右侧：动作按钮 */}
        <div className="flex items-center gap-2 z-10">
          <Link href="/history">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">历史记录</span>
            </Button>
          </Link>
          <ThemeToggle />
          <a href="/#top">
            <Button size="sm" className="gap-1.5">
              <ArrowUp className="h-4 w-4" />
              <span className="hidden sm:inline">开始审核</span>
            </Button>
          </a>
        </div>
      </div>
    </header>
  )
}
