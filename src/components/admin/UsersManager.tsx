"use client";

import { useCallback, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from "@/lib/auth/permissions";
import { useAdmin, useApiErrorHandler, useLoader } from "./AdminContext";
import { Field, StatusPill } from "./forms";

type U = {
  id: string;
  email: string;
  displayName: string;
  color: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  roles: RoleCode[];
};

const ROLE_DESC: Record<RoleCode, string> = {
  SUPER_ADMIN: "모든 권한 + 계정 관리",
  EDITOR: "제보·사건·기사·속보·클립·팀·큐시트",
  ANCHOR: "뉴스 진행자: 본인 대본 작성, 큐 진행, 프롬프터",
  OPERATOR: "속보 송출·OBS·큐시트·방송 운영·사이트 설정",
};

const isPlaceholderEmail = (e: string) => /@(example\.(com|org|net)|rwn\.local)$/i.test(e);

export function UsersManager({ selfId }: { selfId: string }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [users, setUsers] = useState<U[] | null>(null);
  const [f, setF] = useState({ email: "", displayName: "", password: "", color: "#3b82f6", roles: ["EDITOR"] as RoleCode[] });

  const load = useCallback(async () => setUsers((await api<{ users: U[] }>("GET", "/api/admin/users")).users), [api]);
  useLoader(load);

  async function patch(u: U, body: Record<string, unknown>, msg: string) {
    try {
      await api("PATCH", `/api/admin/users/${u.id}`, body);
      toast(msg);
      // 내 역할을 바꾸면 세션이 종료되므로 다시 로그인
      if (u.id === selfId && (body.roles || body.password)) window.location.assign("/login");
      return true;
    } catch (e) {
      onError(e);
      return false;
    } finally {
      load();
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="panel divide-y divide-line">
        {!users && <p className="p-4 text-muted">불러오는 중…</p>}
        {users?.map((u) => (
          <UserRow key={`${u.id}:${u.email}:${u.mustChangePassword}`} u={u} self={u.id === selfId} patch={patch} />
        ))}
      </div>

      <section className="panel flex flex-col gap-3 self-start p-4">
        <h2 className="font-bold">계정 추가</h2>
        <Field label="이메일 (로그인 ID)">
          <input className="field" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="표시 이름">
          <input className="field" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} maxLength={30} placeholder="예) 김옥독" />
        </Field>
        <Field label="임시 비밀번호" hint="10자 이상, 문자와 숫자 포함. 첫 로그인 때 본인이 새 비밀번호로 바꾸도록 요구됩니다.">
          <input className="field" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <Field label="표시 색상">
          <input type="color" className="field h-10 p-1" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        </Field>
        <Field label="역할 (복수 선택)">
          <div className="flex flex-col gap-1">
            {ROLE_CODES.map((r) => (
              <label key={r} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-alert" checked={f.roles.includes(r)} onChange={(e) => setF({ ...f, roles: e.target.checked ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} />
                <span>
                  <b>{ROLE_LABELS[r]}</b> <span className="text-xs text-dim">{ROLE_DESC[r]}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        <button
          className="btn btn-red"
          disabled={!f.email || !f.displayName || !f.password || f.roles.length === 0}
          onClick={async () => {
            try {
              await api("POST", "/api/admin/users", f);
              toast("계정을 만들었습니다. 임시 비밀번호를 안전한 경로로 전달하세요.");
              setF({ ...f, email: "", displayName: "", password: "" });
              load();
            } catch (e) {
              onError(e);
            }
          }}
        >
          계정 만들기
        </button>
      </section>
    </div>
  );
}

function UserRow({ u, self, patch }: { u: U; self: boolean; patch: (u: U, body: Record<string, unknown>, msg: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"none" | "email" | "password">("none");
  const [email, setEmail] = useState(u.email);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: u.color ?? "#64748b" }} />
        <span className="font-bold">{u.displayName}</span>
        <span className="text-sm text-muted">{u.email}</span>
        {isPlaceholderEmail(u.email) && <StatusPill tone="amber">예시 이메일 — 실제 주소로 변경 필요</StatusPill>}
        {!u.isActive && <StatusPill tone="red">비활성</StatusPill>}
        {u.mustChangePassword && <StatusPill tone="amber">임시 비밀번호 (첫 로그인 시 변경)</StatusPill>}
        {self && <StatusPill tone="blue">나</StatusPill>}
        <span className="ml-auto font-mono text-xs text-dim">
          최근 로그인 {fmtDateTime(u.lastLoginAt)} · 비밀번호 변경 {fmtDateTime(u.passwordChangedAt)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ROLE_CODES.map((r) => {
          const on = u.roles.includes(r);
          return (
            <button
              key={r}
              title={ROLE_DESC[r]}
              className={`rounded border px-2 py-1 text-xs font-bold ${on ? "border-alert bg-alert/15 text-ink" : "border-line text-dim"}`}
              onClick={() => patch(u, { roles: on ? u.roles.filter((x) => x !== r) : [...u.roles, r] }, "역할을 변경했습니다. 해당 사용자는 다시 로그인해야 합니다.")}
            >
              {on ? "✓ " : ""}
              {ROLE_LABELS[r]}
            </button>
          );
        })}
        <input
          type="color"
          className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent"
          defaultValue={u.color ?? "#64748b"}
          onBlur={(e) => e.target.value !== u.color && patch(u, { color: e.target.value }, "색상을 변경했습니다.")}
          title="진행자 표시 색상"
        />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button className="btn btn-sm" onClick={() => setMode(mode === "email" ? "none" : "email")}>
            이메일 변경
          </button>
          <button className="btn btn-sm" onClick={() => setMode(mode === "password" ? "none" : "password")}>
            비밀번호 재설정
          </button>
          {!self && (
            <button className="btn btn-sm" onClick={() => patch(u, { isActive: !u.isActive }, u.isActive ? "비활성화했습니다." : "활성화했습니다.")}>
              {u.isActive ? "비활성화" : "활성화"}
            </button>
          )}
        </div>
      </div>

      {mode === "email" && (
        <form
          className="flex flex-col gap-2 rounded border border-line p-3 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await patch(u, { email }, "이메일을 변경했습니다. 다음 로그인부터 새 이메일을 사용합니다.")) setMode("none");
          }}
        >
          <Field label="새 이메일 (로그인 ID)" className="flex-1" hint="계정 ID 는 유지되므로 기사·큐시트·대본 연결은 그대로입니다.">
            <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button className="btn btn-red btn-sm" disabled={!email || email.toLowerCase() === u.email.toLowerCase()}>
            저장
          </button>
        </form>
      )}

      {mode === "password" && (
        <form
          className="flex flex-col gap-2 rounded border border-line p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await patch(u, { password: pw }, self ? "비밀번호를 변경했습니다." : "비밀번호를 재설정했습니다. 다음 로그인 때 본인이 변경하도록 요구됩니다.")) {
              setPw("");
              setPw2("");
              setMode("none");
            }
          }}
        >
          <p className="text-xs text-dim">
            {self
              ? "본인 비밀번호는 '비밀번호 변경' 화면(현재 비밀번호 확인)을 권장합니다."
              : "새 임시 비밀번호를 입력하세요. 해당 계정의 모든 로그인이 종료되고, 다음 로그인 때 비밀번호 변경이 요구됩니다."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" type="password" autoComplete="new-password" placeholder="새 비밀번호 (10자+, 문자+숫자)" value={pw} onChange={(e) => setPw(e.target.value)} />
            <input className="field" type="password" autoComplete="new-password" placeholder="새 비밀번호 확인" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          {pw2 && pw !== pw2 && <p className="text-xs text-alert">비밀번호 확인이 일치하지 않습니다.</p>}
          <button className="btn btn-red btn-sm self-start" disabled={!pw || pw !== pw2}>
            재설정
          </button>
        </form>
      )}
    </div>
  );
}
