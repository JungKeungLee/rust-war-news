export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** 낙관적 잠금 충돌. 다른 관리자가 먼저 수정한 경우 */
export class ConflictError extends ApiError {
  constructor(current?: unknown) {
    super(409, "다른 관리자가 먼저 변경했습니다. 최신 내용을 확인한 뒤 다시 시도하세요.", { current });
  }
}

export const notFound = (what = "대상") => new ApiError(404, `${what}을(를) 찾을 수 없습니다.`);
