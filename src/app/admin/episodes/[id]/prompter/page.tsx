import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getEpisodeFull } from "@/server/admin";
import { Forbidden, requirePagePermission } from "@/components/admin/guard";
import { Prompter } from "@/components/admin/Prompter";
import type { EpisodeFullJson } from "@/components/admin/episode-types";

export const metadata = { title: "프롬프터" };

export default async function PrompterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ anchor?: string }> }) {
  const session = await requirePagePermission("rundown.operate");
  if (!session) return <Forbidden />;
  const { id } = await params;
  const { anchor } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getEpisodeFull(await getDb(), id);
  if (!data) notFound();
  // 진행자 본인이 열면 자기 대본을 기본 필터로
  const defaultAnchor = anchor ?? (data.anchors.some((a) => a.id === session.userId) ? session.userId : "all");
  return <Prompter initial={JSON.parse(JSON.stringify(data)) as EpisodeFullJson} defaultAnchor={defaultAnchor} />;
}
