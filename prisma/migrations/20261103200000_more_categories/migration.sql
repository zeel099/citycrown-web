-- Five more categories (ten in all), each opening with an All-time and a Today board in every city.
INSERT INTO "Category" ("id", "name", "slug", "banned", "active")
VALUES
  ('category_bakeries',    'Bakeries',    'bakeries',    false, true),
  ('category_sweet_shops', 'Sweet shops', 'sweet-shops', false, true),
  ('category_spas',        'Spas',        'spas',        false, true),
  ('category_boutiques',   'Boutiques',   'boutiques',   false, true),
  ('category_pet_shops',   'Pet shops',   'pet-shops',   false, true)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Board" ("id", "cityId", "categoryId", "type")
SELECT 'board_' || md5(c."id" || '|' || k."id" || '|' || t."type"), c."id", k."id", t."type"::"BoardType"
FROM "City" c
CROSS JOIN "Category" k
CROSS JOIN (VALUES ('ALL_TIME'), ('DAILY')) AS t("type")
WHERE k."slug" IN ('bakeries', 'sweet-shops', 'spas', 'boutiques', 'pet-shops')
  AND NOT k."banned"
ON CONFLICT ("cityId", "categoryId", "type") DO NOTHING;
