-- 0018_license_app_version.sql — the app version each device last reported (shown in /licenses).
-- The app also adds this column on first use, so existing databases need no manual step.
alter table station_licenses add column if not exists app_version text not null default '';
