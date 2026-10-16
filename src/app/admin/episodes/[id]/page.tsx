import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getEpisodeFull, getLookups } from "@/server/admin";
import { Forbidden, requirePagePermission } from "@/components/admin/guard";
import { RundownEditor } from "@/components/admin/RundownEditor";
import type { EpisodeFullJson } from "@/components/admin/episode-types";

export const metadata = { title: "큐시트" };

export default async function EpisodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requirePagePermission("rundown.operate"))) return <Forbidden />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [data, lookups] = await Promise.all([getEpisodeFull(db, id), getLookups(db)]);
  if (!data) notFound();
  const initial = JSON.parse(JSON.stringify(data)) as EpisodeFullJson;
  return <RundownEditor initial={initial} lookups={JSON.parse(JSON.stringify(lookups))} />;
}
