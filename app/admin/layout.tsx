import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자 - 동네 가게",
  description: "가게 관리자 페이지",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
