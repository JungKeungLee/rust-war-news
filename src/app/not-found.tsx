import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="panel max-w-md p-8 text-center">
        <div className="font-mono text-xs tracking-widest text-dim">404 · NO SIGNAL</div>
        <h1 className="mt-2 text-xl font-black">요청한 페이지를 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm text-muted">삭제되었거나 아직 공개되지 않은 콘텐츠일 수 있습니다.</p>
        <Link href="/" className="btn mt-4">
          홈으로
        </Link>
      </div>
    </div>
  );
}
