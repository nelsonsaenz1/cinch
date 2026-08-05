-- The plate-ready garment render.
--
-- `cutout_path` is the raw Vision subject lift; `plate_path` is that cutout
-- scale-normalized onto a fixed transparent canvas at ingest (per-slot target
-- fill, shared bottom baseline) so a stacked outfit reads at one scale. Kept
-- separate from the cutout on purpose: normalization parameters will be tuned,
-- and re-normalizing from the stored cutout costs nothing, while re-lifting
-- from the original costs a Vision pass per item.
alter table items add column if not exists plate_path text;
