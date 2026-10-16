-- 시드 스크립트로 임시 비밀번호를 받은 뒤 한 번도 로그인하지 않은 진행자 계정에 "비밀번호 변경 필요" 표시.
-- 대상: ANCHOR 역할 보유 + SUPER_ADMIN 아님 + 로그인 기록 없음 + 비밀번호 변경 기록 없음.
-- 행 삭제·컬럼 변경 없음. 재실행해도 결과 동일.
UPDATE "users" SET "must_change_password" = true
WHERE "last_login_at" IS NULL
  AND "password_changed_at" IS NULL
  AND "id" IN (SELECT ur."user_id" FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id" WHERE r."code" = 'ANCHOR')
  AND "id" NOT IN (SELECT ur."user_id" FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id" WHERE r."code" = 'SUPER_ADMIN');
