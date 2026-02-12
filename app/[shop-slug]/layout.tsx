import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "가게 예약",
  description: "우리 동네 가게 상품 예약",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#ffffff",
};

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
