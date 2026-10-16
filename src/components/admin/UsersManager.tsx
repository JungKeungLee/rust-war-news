"use client";

import { useCallback, useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from "@/lib/auth/permissions";
import { useAdmin, useApiErrorHandler, useLoader } from "./AdminContext";
import { Field, StatusPill } from "./forms";

type U = { id: string; email: string; displayName: string; color: string | null; isActive: boolean; lastLoginAt: string | null; roles: RoleCode[] };

const ROLE_DESC: Record<RoleCode, string> = {
  SUPER_ADMIN: "모든 권한 + 계정 관리",
  EDITOR: "제보·사건·기사·속보·클립·팀·큐시트",
  ANCHOR: "뉴스 진행자: 본인 대본 작성, 큐 진행, 프롬프터",
  OPERATOR: "속보 송출·OBS·큐시트·방송 운영·사이트 설정",
};

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
      if (u.id === selfId && (body.roles || body.password)) window.location.assign("/login");
    } catch (e) {
      onError(e);
    } finally {
      load();
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <div className="panel divide-y divide-line">
        {!users && <p className="p-4 text-muted">불러오는 중…</p>}
        {users?.map((u) => (
          <div key={u.id} className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: u.color ?? "#64748b" }} />
              <span className="font-bold">{u.displayName}</span>
              <span className="text-sm text-muted">{u.email}</span>
              {!u.isActive && <StatusPill tone="red">비활성</StatusPill>}
              {u.id === selfId && <StatusPill tone="blue">나</StatusPill>}
              <span className="ml-auto font-mono text-xs text-dim">최근 로그인 {fmtDateTime(u.lastLoginAt)}</span>
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
              <button className="btn btn-sm ml-auto" onClick={() => patch(u, { isActive: !u.isActive }, u.isActive ? "비활성화했습니다." : "활성화했습니다.")}>
                {u.isActive ? "비활성화" : "활성화"}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  const pw = prompt(`${u.displayName}의 새 비밀번호 (10자 이상, 문자+숫자)`);
                  if (pw) patch(u, { password: pw }, "비밀번호를 재설정했습니다.");
                }}
              >
                비밀번호 재설정
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="panel flex flex-col gap-3 self-start p-4">
        <h2 className="font-bold">계정 추가</h2>
        <Field label="이메일">
          <input className="field" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="표시 이름">
          <input className="field" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} maxLength={30} placeholder="예) 난워니" />
        </Field>
        <Field label="초기 비밀번호" hint="10자 이상, 문자와 숫자 포함. 전달 후 본인이 변경하도록 안내하세요.">
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
              toast("계정을 만들었습니다.");
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
