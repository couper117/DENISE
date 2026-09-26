-- Night (hard) and day (soft) curtains become sub-categories of "Curtains", so
-- the shop can file each curtain under the part of the window it is for and the
-- product page can offer a matching day curtain with a night one.
--
-- Data only and idempotent: nothing is created when the slug already exists,
-- and when there is no "curtains" category the two are created at top level.
-- Existing products are not moved; the admin assigns them.
INSERT INTO "Category" ("id", "name", "slug", "description", "isActive", "sortOrder", "parentId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v.slug, v.description, true, v.sort_order,
       (SELECT "id" FROM "Category" WHERE "slug" = 'curtains' LIMIT 1),
       NOW(), NOW()
FROM (VALUES
  ('Hard Curtains (Rideau de nuit)', 'hard-curtains', 'Heavy night curtains that block light and give privacy', 1),
  ('Soft Curtains (Rideau du jour)', 'soft-curtains', 'Light day curtains that soften daylight', 2)
) AS v(name, slug, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "Category" c WHERE c."slug" = v.slug);
