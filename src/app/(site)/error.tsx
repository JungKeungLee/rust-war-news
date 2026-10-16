"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel mx-auto max-w-lg border-alert/50 p-8 text-center">
      <div className="font-mono text-xs tracking-widest text-alert">SIGNAL LOST</div>
      <h1 className="mt-2 text-xl font-black">페이지를 불러오지 못했습니다</h1>
      <p className="mt-2 text-sm text-muted">일시적인 오류일 수 있습니다. 잠시 후 다시 시도하세요.</p>
      <button onClick={reset} className="btn mt-4">
        다시 시도
      </button>
    </div>
  );
}
