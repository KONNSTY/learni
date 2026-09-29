-- Seed: Launch-Sprachen (generiert aus content/languages.json)
insert into public.languages (code, name, native_name, tier, badge, region_variants) values
  ('en','English','English','A','EN','{en-GB,en-US}'),
  ('es','Spanish','Español','A','ES','{es-ES,es-MX}'),
  ('fr','French','Français','A','FR','{}'),
  ('hr','Croatian','Hrvatski','B','HR','{}'),
  ('id','Indonesian','Bahasa Indonesia','B','ID','{}'),
  ('tr','Turkish','Türkçe','B','TR','{}')
on conflict (code) do update set name = excluded.name, native_name = excluded.native_name, tier = excluded.tier, badge = excluded.badge, region_variants = excluded.region_variants;
