"use client";

export function LogoutButton() {
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.assign("/login");
      }}
    >
      로그아웃
    </button>
  );
}
