import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt 파라미터: N=2^15, r=8, p=1 (약 32MB 메모리). 저장 형식에 파라미터를 포함해 추후 상향 가능.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 256 * N * R });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * Number(n) * Number(r),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** 사용자가 없을 때도 같은 시간이 걸리도록 비교용 더미 해시 검증을 수행한다. */
export async function fakeVerify(): Promise<void> {
  await scrypt("dummy-password", Buffer.alloc(16), KEYLEN, { N, r: R, p: P, maxmem: 256 * N * R });
}

/** 관리자 비밀번호 정책: 10자 이상, 문자와 숫자 포함 */
export function passwordPolicyError(password: string): string | null {
  if (password.length < 10) return "비밀번호는 10자 이상이어야 합니다.";
  if (password.length > 200) return "비밀번호가 너무 깁니다.";
  if (!/[A-Za-z가-힣]/.test(password) || !/[0-9]/.test(password)) return "비밀번호에 문자와 숫자를 모두 포함하세요.";
  return null;
}

/** 시드용 임의 비밀번호 */
export function generatePassword(): string {
  return randomBytes(12).toString("base64url") + "7a";
}
