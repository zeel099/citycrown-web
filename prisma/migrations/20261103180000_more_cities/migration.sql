-- More cities: the metros and the big tech hubs, each with its centre (address search bias and
-- the "is it in this city?" check), opening with an All-time and a Today board per category.
INSERT INTO "City" ("id", "name", "slug", "country", "currency", "timeZone", "active", "latitude", "longitude")
VALUES
  ('city_delhi',      'Delhi',      'delhi',      'IN', 'INR', 'Asia/Kolkata', true, 28.6315, 77.2167),
  ('city_bengaluru',  'Bengaluru',  'bengaluru',  'IN', 'INR', 'Asia/Kolkata', true, 12.9716, 77.5946),
  ('city_hyderabad',  'Hyderabad',  'hyderabad',  'IN', 'INR', 'Asia/Kolkata', true, 17.3850, 78.4867),
  ('city_chennai',    'Chennai',    'chennai',    'IN', 'INR', 'Asia/Kolkata', true, 13.0827, 80.2707),
  ('city_kolkata',    'Kolkata',    'kolkata',    'IN', 'INR', 'Asia/Kolkata', true, 22.5726, 88.3639),
  ('city_gurugram',   'Gurugram',   'gurugram',   'IN', 'INR', 'Asia/Kolkata', true, 28.4595, 77.0266),
  ('city_noida',      'Noida',      'noida',      'IN', 'INR', 'Asia/Kolkata', true, 28.5700, 77.3210),
  ('city_mohali',     'Mohali',     'mohali',     'IN', 'INR', 'Asia/Kolkata', true, 30.7046, 76.7179),
  ('city_chandigarh', 'Chandigarh', 'chandigarh', 'IN', 'INR', 'Asia/Kolkata', true, 30.7333, 76.7794),
  ('city_kochi',      'Kochi',      'kochi',      'IN', 'INR', 'Asia/Kolkata', true, 9.9312, 76.2673),
  ('city_indore',     'Indore',     'indore',     'IN', 'INR', 'Asia/Kolkata', true, 22.7196, 75.8577),
  ('city_jaipur',     'Jaipur',     'jaipur',     'IN', 'INR', 'Asia/Kolkata', true, 26.9124, 75.7873)
-- Already added by staff: keep it as it is, but give it a centre if it has none.
ON CONFLICT ("slug") DO UPDATE
  SET "latitude" = EXCLUDED."latitude", "longitude" = EXCLUDED."longitude"
  WHERE "City"."latitude" IS NULL OR "City"."longitude" IS NULL;

INSERT INTO "Board" ("id", "cityId", "categoryId", "type")
SELECT 'board_' || md5(c."id" || '|' || k."id" || '|' || t."type"), c."id", k."id", t."type"::"BoardType"
FROM "City" c
CROSS JOIN "Category" k
CROSS JOIN (VALUES ('ALL_TIME'), ('DAILY')) AS t("type")
WHERE c."slug" IN ('delhi', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'gurugram', 'noida', 'mohali', 'chandigarh', 'kochi', 'indore', 'jaipur')
  AND NOT k."banned"
ON CONFLICT ("cityId", "categoryId", "type") DO NOTHING;
