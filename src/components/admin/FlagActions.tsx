"use client";

import { useRouter } from "next/navigation";
import { useAdmin, useApiErrorHandler } from "./AdminContext";

export function FlagActions({ id }: { id: string }) {
  const { api, toast } = useAdmin();
  const onError = useApiErrorHandler();
  const router = useRouter();
  const set = async (status: "RESOLVED" | "DISMISSED") => {
    try {
      await api("PATCH", `/api/admin/flags/${id}`, { status });
      toast(status === "RESOLVED" ? "처리 완료" : "기각");
      router.refresh();
    } catch (e) {
      onError(e);
    }
  };
  return (
    <span className="flex gap-1">
      <button className="btn btn-sm" onClick={() => set("RESOLVED")}>
        처리
      </button>
      <button className="btn btn-sm btn-ghost" onClick={() => set("DISMISSED")}>
        기각
      </button>
    </span>
  );
}
