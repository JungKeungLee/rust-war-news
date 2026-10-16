import { z } from "zod";
import { cleanText, safeHttpsUrl } from "@/lib/security/sanitize";
import { INCIDENT_TYPES, VERIFICATION } from "@/lib/labels";

/** 한 줄 텍스트: HTML 제거 + 길이 제한 */
export const zText = (max: number, min = 1) =>
  z
    .string()
    .transform((s) => cleanText(s))
    .pipe(z.string().min(min, min === 1 ? "필수 입력입니다." : `${min}자 이상 입력하세요.`).max(max, `${max}자 이하로 입력하세요.`));

/** 여러 줄 텍스트 */
export const zLongText = (max: number, min = 1) =>
  z
    .string()
    .transform((s) => cleanText(s, { multiline: true }))
    .pipe(z.string().min(min, min === 1 ? "필수 입력입니다." : `${min}자 이상 입력하세요.`).max(max, `${max}자 이하로 입력하세요.`));

/** 선택 텍스트: 빈 값은 null */
export const zOptText = (max: number, multiline = false) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((s) => (s ? cleanText(s, { multiline }) : "") || null)
    .pipe(z.string().max(max, `${max}자 이하로 입력하세요.`).nullable());

/** 선택 날짜: ISO 문자열 또는 null */
export const zOptDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "날짜 형식이 올바르지 않습니다." });
      return z.NEVER;
    }
    return d;
  });

/** 선택 https URL: 안전하지 않으면 오류 */
export const zOptUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const safe = safeHttpsUrl(v);
    if (!safe) {
      ctx.addIssue({ code: "custom", message: "https:// 로 시작하는 올바른 외부 주소만 입력할 수 있습니다." });
      return z.NEVER;
    }
    return safe;
  });

export const zUuid = z.uuid("잘못된 ID 입니다.");
export const zOptUuid = z
  .union([z.uuid(), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v || null);
export const zVersion = z.number().int().min(1);
export const zIncidentType = z.enum(INCIDENT_TYPES);
export const zVerification = z.enum(VERIFICATION);
export const zColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "색상은 #RRGGBB 형식이어야 합니다.");
