"use client";

import { useCallback, useState } from "react";
import { fmtDate } from "@/lib/format";
import { useAdmin, useApiErrorHandler, useLoader } from "./AdminContext";
import { DateTimeInput, Field, ImageInput, StatusPill, Toggle } from "./forms";

type Event = { id: string; name: string; season: string | null; description: string | null; startsAt: string | null; endsAt: string | null; isActive: boolean };
type Team = {
  id: string;
  eventId: string;
  name: string;
  shortName: string | null;
  color: string;
  logoUrl: string | null;
  description: string | null;
  statusLabel: string | null;
  score: number;
  isEliminated: boolean;
  isPublic: boolean;
  version: number;
};
type Player = { id: string; nickname: string; profile: string | null; streamUrl: string | null; avatarUrl: string | null };
type Member = { id: string; teamId: string; playerId: string; role: string | null; leftAt: string | null };
type Data = { events: Event[]; teams: Team[]; players: Player[]; members: Member[] };

export function TeamsManager() {
  const { api } = useAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = await api<Data>("GET", "/api/admin/teams");
    setData(d);
    setEventId((cur) => cur ?? d.events.find((e) => e.isActive)?.id ?? d.events[0]?.id ?? null);
  }, [api]);
  useLoader(load);

  if (!data) return <div className="panel h-40 animate-pulse" />;
  const ev = data.events.find((e) => e.id === eventId) ?? null;
  const teams = data.teams.filter((t) => t.eventId === eventId);

  return (
    <div className="flex flex-col gap-6">
      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="panel-head">대결 / 시즌</span>
          {data.events.map((e) => (
            <button key={e.id} className={`btn btn-sm ${e.id === eventId ? "border-alert bg-alert/15" : ""}`} onClick={() => setEventId(e.id)}>
              {e.name} {e.isActive && "●"}
            </button>
          ))}
        </div>
        <EventForm key={ev?.id ?? "new"} ev={ev} onSaved={load} />
        {ev && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">+ 새 대결 추가</summary>
            <div className="mt-2">
              <EventForm ev={null} onSaved={load} />
            </div>
          </details>
        )}
      </section>

      {ev && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{ev.name} 참가 팀</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {teams.map((t) => (
              <TeamCard key={`${t.id}:${t.version}`} team={t} players={data.players} members={data.members.filter((m) => m.teamId === t.id)} onChanged={load} />
            ))}
            <TeamForm eventId={ev.id} onSaved={load} />
          </div>
        </section>
      )}

      <PlayersSection players={data.players} onChanged={load} />
    </div>
  );
}

function EventForm({ ev, onSaved }: { ev: Event | null; onSaved: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [f, setF] = useState({ name: ev?.name ?? "", season: ev?.season ?? "", description: ev?.description ?? "", startsAt: ev?.startsAt ?? null, endsAt: ev?.endsAt ?? null, isActive: ev?.isActive ?? true });
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <Field label="대결 이름">
        <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} />
      </Field>
      <Field label="시즌">
        <input className="field" value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} maxLength={40} />
      </Field>
      <Field label="시작">
        <DateTimeInput value={f.startsAt} onChange={(v) => setF({ ...f, startsAt: v })} />
      </Field>
      <Field label="종료">
        <DateTimeInput value={f.endsAt} onChange={(v) => setF({ ...f, endsAt: v })} />
      </Field>
      <Field label="소개" className="md:col-span-3">
        <input className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
      </Field>
      <div className="flex items-end gap-3">
        <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="진행 중" />
        <button
          className="btn btn-red btn-sm"
          disabled={!f.name.trim()}
          onClick={async () => {
            try {
              await api(ev ? "PATCH" : "POST", ev ? `/api/admin/events/${ev.id}` : "/api/admin/events", f);
              toast("대결 정보를 저장했습니다.");
              onSaved();
            } catch (e) {
              onError(e);
            }
          }}
        >
          {ev ? "저장" : "추가"}
        </button>
      </div>
    </div>
  );
}

function TeamForm({ eventId, team, onSaved, onCancel }: { eventId: string; team?: Team; onSaved: () => void; onCancel?: () => void }) {
  const { api, toast, upload } = useAdmin();
  const onError = useApiErrorHandler();
  const [f, setF] = useState({
    name: team?.name ?? "",
    shortName: team?.shortName ?? "",
    color: team?.color ?? "#3b82f6",
    logoUrl: team?.logoUrl ?? null,
    description: team?.description ?? "",
    statusLabel: team?.statusLabel ?? "",
    score: team?.score ?? 0,
    isEliminated: team?.isEliminated ?? false,
    isPublic: team?.isPublic ?? true,
  });
  return (
    <div className="panel grid gap-2 p-3 sm:grid-cols-2">
      {!team && <div className="font-bold sm:col-span-2">+ 팀 추가</div>}
      <Field label="팀 이름">
        <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={40} />
      </Field>
      <Field label="약칭">
        <input className="field" value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} maxLength={10} />
      </Field>
      <Field label="팀 색상">
        <input type="color" className="field h-10 p-1" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
      </Field>
      <Field label="점수">
        <input type="number" className="field" value={f.score} onChange={(e) => setF({ ...f, score: Number(e.target.value) })} />
      </Field>
      <Field label="상황판 상태 문구">
        <input className="field" value={f.statusLabel} onChange={(e) => setF({ ...f, statusLabel: e.target.value })} maxLength={20} placeholder="예) 공세, 수세" />
      </Field>
      <div className="flex flex-col justify-end gap-1">
        <Toggle checked={f.isPublic} onChange={(v) => setF({ ...f, isPublic: v })} label="공개" />
        <Toggle checked={f.isEliminated} onChange={(v) => setF({ ...f, isEliminated: v })} label="탈락" />
      </div>
      <Field label="로고" className="sm:col-span-2">
        <ImageInput value={f.logoUrl} onChange={(v) => setF({ ...f, logoUrl: v })} upload={upload} />
      </Field>
      <Field label="팀 소개" className="sm:col-span-2">
        <textarea className="field min-h-16" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <button
          className="btn btn-red btn-sm"
          disabled={!f.name.trim()}
          onClick={async () => {
            try {
              if (team) await api("PATCH", `/api/admin/teams/${team.id}`, { ...f, eventId, version: team.version });
              else await api("POST", "/api/admin/teams", { ...f, eventId });
              toast("팀을 저장했습니다.");
              onSaved();
            } catch (e) {
              onError(e, onSaved);
            }
          }}
        >
          저장
        </button>
        {onCancel && (
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </div>
  );
}

function TeamCard({ team, players, members, onChanged }: { team: Team; players: Player[]; members: Member[]; onChanged: () => void }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const [editing, setEditing] = useState(false);
  const [addPlayer, setAddPlayer] = useState("");
  const [role, setRole] = useState("");
  if (editing) return <TeamForm eventId={team.eventId} team={team} onSaved={() => (setEditing(false), onChanged())} onCancel={() => setEditing(false)} />;

  const call = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
    } catch (e) {
      onError(e);
    } finally {
      onChanged();
    }
  };

  return (
    <div className="panel overflow-hidden">
      <div className="h-1.5" style={{ background: team.color }} />
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold">{team.name}</span>
          <span className="font-mono">{team.score}점</span>
          {team.statusLabel && <StatusPill tone="blue">{team.statusLabel}</StatusPill>}
          {!team.isPublic && <StatusPill>비공개</StatusPill>}
          {team.isEliminated && <StatusPill tone="red">탈락</StatusPill>}
          <div className="ml-auto flex gap-1">
            <button className="btn btn-sm" onClick={() => call(() => api("PATCH", `/api/admin/teams/${team.id}`, { ...team, score: team.score + 1 }), "+1점")}>
              +1
            </button>
            <button className="btn btn-sm" onClick={() => call(() => api("PATCH", `/api/admin/teams/${team.id}`, { ...team, score: team.score - 1 }), "-1점")}>
              -1
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              편집
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => confirm(`${team.name} 팀을 삭제할까요? 소속·사건 연결도 함께 삭제됩니다.`) && call(() => api("DELETE", `/api/admin/teams/${team.id}`), "삭제했습니다.")}>
              ✕
            </button>
          </div>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {members.map((m) => {
            const p = players.find((x) => x.id === m.playerId);
            return (
              <li key={m.id} className={`flex items-center gap-2 ${m.leftAt ? "text-dim line-through" : ""}`}>
                <span className="flex-1">
                  {p?.nickname} {m.role && <span className="text-xs text-muted">· {m.role}</span>} {m.leftAt && <span className="text-xs">({fmtDate(m.leftAt)} 탈퇴)</span>}
                </span>
                {!m.leftAt && (
                  <button className="text-xs text-muted hover:text-ink" onClick={() => call(() => api("PATCH", `/api/admin/team-members/${m.id}`, { leftAt: new Date().toISOString() }), "탈퇴 처리")}>
                    탈퇴
                  </button>
                )}
                <button className="text-xs text-muted hover:text-alert" onClick={() => call(() => api("DELETE", `/api/admin/team-members/${m.id}`), "소속 삭제")}>
                  삭제
                </button>
              </li>
            );
          })}
          {members.length === 0 && <li className="text-xs text-dim">소속 선수 없음</li>}
        </ul>
        <div className="mt-2 flex gap-1">
          <select className="field py-1 text-sm" value={addPlayer} onChange={(e) => setAddPlayer(e.target.value)}>
            <option value="">선수 추가…</option>
            {players
              .filter((p) => !members.some((m) => m.playerId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname}
                </option>
              ))}
          </select>
          <input className="field w-28 py-1 text-sm" placeholder="역할" value={role} onChange={(e) => setRole(e.target.value)} maxLength={20} />
          <button
            className="btn btn-sm"
            disabled={!addPlayer}
            onClick={() => call(() => api("POST", "/api/admin/team-members", { teamId: team.id, playerId: addPlayer, role, joinedAt: new Date().toISOString() }), "선수를 연결했습니다.").then(() => (setAddPlayer(""), setRole("")))}
          >
            연결
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayersSection({ players, onChanged }: { players: Player[]; onChanged: () => void }) {
  const { api, toast, upload } = useAdmin();
  const onError = useApiErrorHandler();
  const [editId, setEditId] = useState<string | null>(null);
  const empty = { nickname: "", profile: "", streamUrl: "", avatarUrl: null as string | null };
  const [f, setF] = useState(empty);

  function startEdit(p: Player | null) {
    setEditId(p?.id ?? "new");
    setF(p ? { nickname: p.nickname, profile: p.profile ?? "", streamUrl: p.streamUrl ?? "", avatarUrl: p.avatarUrl } : empty);
  }

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">선수 ({players.length})</h2>
        <button className="btn btn-sm btn-red" onClick={() => startEdit(null)}>
          + 선수 등록
        </button>
      </div>
      {editId && (
        <div className="mb-4 grid gap-2 rounded border border-line p-3 md:grid-cols-2">
          <Field label="닉네임">
            <input className="field" value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} maxLength={40} />
          </Field>
          <Field label="방송 주소">
            <input className="field" value={f.streamUrl} onChange={(e) => setF({ ...f, streamUrl: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="프로필" className="md:col-span-2">
            <textarea className="field min-h-16" value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value })} maxLength={1000} />
          </Field>
          <Field label="프로필 이미지" className="md:col-span-2">
            <ImageInput value={f.avatarUrl} onChange={(v) => setF({ ...f, avatarUrl: v })} upload={upload} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn btn-red btn-sm"
              disabled={!f.nickname.trim()}
              onClick={async () => {
                try {
                  await api(editId === "new" ? "POST" : "PATCH", editId === "new" ? "/api/admin/players" : `/api/admin/players/${editId}`, { ...f, streamUrl: f.streamUrl || null });
                  toast("선수 정보를 저장했습니다.");
                  setEditId(null);
                  onChanged();
                } catch (e) {
                  onError(e);
                }
              }}
            >
              저장
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>
              취소
            </button>
          </div>
        </div>
      )}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded border border-line p-2 text-sm">
            <span className="flex-1 font-semibold">{p.nickname}</span>
            {p.streamUrl && (
              <a href={p.streamUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300">
                방송↗
              </a>
            )}
            <button className="text-xs text-muted hover:text-ink" onClick={() => startEdit(p)}>
              편집
            </button>
            <button
              className="text-xs text-muted hover:text-alert"
              onClick={async () => {
                if (!confirm(`${p.nickname} 선수를 삭제할까요?`)) return;
                try {
                  await api("DELETE", `/api/admin/players/${p.id}`);
                  onChanged();
                } catch (e) {
                  onError(e);
                }
              }}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
