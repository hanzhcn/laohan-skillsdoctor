import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "skill-doctor — skill 体检仪表盘",
  description:
    "扫描分类 Claude Code / OpenClaw skills，检测污染副本/漂移/孤儿/失效链接",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
