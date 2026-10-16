import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * OBS 브라우저 소스 전용 레이아웃: 사이트 메뉴·여백 없음, 투명 배경, 1920×1080 기준.
 * 브라우저에서 확인할 때는 ?bg=1 을 붙이면 체크무늬 배경이 표시된다.
 */
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }
        body { width: 1920px; height: 1080px; }
        body:has(.overlay-preview-bg) { background: repeating-conic-gradient(#2a3346 0% 25%, #1c2333 0% 50%) 50% / 40px 40px !important; }
      `}</style>
      <div className="relative h-[1080px] w-[1920px] overflow-hidden" style={{ fontFamily: "var(--font-sans)" }}>
        {children}
      </div>
    </>
  );
}
