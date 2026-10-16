-- 기준 데이터: 권한 역할, OBS 오버레이 기본 상태, 사이트 기본 설정 (재실행해도 안전)
INSERT INTO "roles" ("code", "name") VALUES
  ('SUPER_ADMIN', '최고 관리자'),
  ('EDITOR', '편집자'),
  ('ANCHOR', '진행자'),
  ('OPERATOR', '방송 운영자')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "overlay_states" ("key", "mode", "payload") VALUES
  ('breaking', 'AUTO', '{}'::jsonb),
  ('ticker', 'AUTO', '{}'::jsonb),
  ('headline', 'AUTO', '{}'::jsonb),
  ('lower_third', 'AUTO', '{}'::jsonb),
  ('war_status', 'AUTO', '{}'::jsonb),
  ('standby', 'AUTO', '{}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES
  ('live', '{"isLive": false, "url": null, "title": null}'::jsonb),
  ('notice', '{"text": null}'::jsonb),
  ('intake', '{"reportsOpen": true, "clipsOpen": true}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
