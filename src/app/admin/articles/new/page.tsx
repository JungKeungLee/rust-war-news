import { getDb } from "@/db";
import { getLookups } from "@/server/admin";
import { AdminTitle, Forbidden, requirePagePermission } from "@/components/admin/guard";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export const metadata = { title: "새 기사" };

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ incident?: string }> }) {
  if (!(await requirePagePermission("articles.manage"))) return <Forbidden />;
  const { incident } = await searchParams;
  const lookups = await getLookups(await getDb());
  const inc = lookups.incidents.find((i) => i.id === incident);
  return (
    <>
      <AdminTitle title="새 기사" />
      <ArticleEditor
        incidents={lookups.incidents}
        clips={lookups.clips}
        initial={{
          id: null,
          version: null,
          title: inc?.title ?? "",
          lead: "",
          body: "",
          status: "DRAFT",
          verificationStatus: inc?.verificationStatus ?? "UNVERIFIED",
          isFeatured: false,
          coverUrl: null,
          incidentId: inc?.id ?? null,
          clipIds: [],
          sourceBreakingId: null,
        }}
        revisions={[]}
      />
    </>
  );
}
