"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 서버 렌더링 실패 시 사용자 화면. 운영 모드에서는 Next.js 가 실제 메시지를 숨기므로
 * digest(오류 식별 코드)를 보여주고, 운영진은 서버 로그에서 같은 digest 로 원인을 찾는다.
 */
export type ErrorBoundaryProps = { error: unknown; retry?: () => void; reset?: () => void };

export function ErrorScreen({ error, retry, reset }: ErrorBoundaryProps) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    console.error("[RWN] 화면 렌더링 오류", digest ?? "", error instanceof Error ? error.message : error);
  }, [error, digest]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <div className="panel w-full max-w-lg border-alert/50 p-8 text-center">
        <div className="font-mono text-xs tracking-widest text-alert">SIGNAL LOST</div>
        <h1 className="mt-2 text-xl font-black">페이지를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted">서버에서 데이터를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도하세요. 문제가 계속되면 아래 코드를 운영진에게 알려주세요.</p>
        {digest && (
          <p className="mt-3 font-mono text-xs text-dim">
            오류 코드 <span className="text-ink">{digest}</span>
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => (retry ?? reset)?.()} className="btn btn-red">
            다시 시도
          </button>
          <Link href="/" className="btn">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
