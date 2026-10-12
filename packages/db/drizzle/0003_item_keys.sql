-- TK-80.3: records.items.key, unique across every project, set once when an
-- item is made and never changed.
--
-- A plan project is one whose scheme's config says {"plan": true}: the seeded
-- `plan` scheme says so, and a scheme forked from it keeps it. A plan scheme
-- seeded before this flag existed gets it here.
UPDATE "structure"."schemes" SET "config" = "config" || '{"plan": true}'::jsonb WHERE "key" = 'plan';--> statement-breakpoint
ALTER TABLE "records"."items" ADD COLUMN "key" text;--> statement-breakpoint
-- A plan project's items take the plan's keys, numbered in the order they were
-- made: an epic PREFIX/E<n>, a feature PREFIX-<n> (the nth of each in its
-- project), a ticket or a subticket its parent's key and .<n> (the nth under
-- that parent).
WITH RECURSIVE "plan_item" AS (
  SELECT i."id", i."parent_id", p."item_prefix", t."key" AS "type_key",
    row_number() OVER (PARTITION BY i."project_id", t."key" ORDER BY i."number") AS "nth_of_type",
    row_number() OVER (PARTITION BY i."parent_id" ORDER BY i."number") AS "nth_child"
  FROM "records"."items" i
  JOIN "core"."projects" p ON p."id" = i."project_id"
  JOIN "structure"."schemes" s ON s."id" = p."scheme_id"
  JOIN "structure"."item_types" t ON t."id" = i."type_id"
  WHERE s."config" @> '{"plan": true}'::jsonb
), "plan_key" AS (
  SELECT "id",
    CASE "type_key" WHEN 'epic' THEN "item_prefix" || '/E' || "nth_of_type"
                    ELSE "item_prefix" || '-' || "nth_of_type" END AS "key"
  FROM "plan_item" WHERE "type_key" IN ('epic', 'feature')
  UNION ALL
  SELECT c."id", k."key" || '.' || c."nth_child"
  FROM "plan_item" c JOIN "plan_key" k ON k."id" = c."parent_id"
  WHERE c."type_key" NOT IN ('epic', 'feature')
)
UPDATE "records"."items" i SET "key" = "plan_key"."key" FROM "plan_key" WHERE "plan_key"."id" = i."id";--> statement-breakpoint
-- Every other item's key is today's PREFIX-number.
UPDATE "records"."items" i SET "key" = p."item_prefix" || '-' || i."number"
FROM "core"."projects" p WHERE p."id" = i."project_id" AND i."key" IS NULL;--> statement-breakpoint
-- projects.item_prefix isn't unique, so two projects sharing a prefix give two
-- items one key. Stop here, saying which, rather than invent keys.
DO $$
DECLARE "clash" text;
BEGIN
  SELECT string_agg(format('%s (items %s of projects %s)', c."key", c."ids", c."projects"), '; ' ORDER BY c."key")
  INTO "clash"
  FROM (
    SELECT i."key",
      string_agg(i."id"::text, ', ' ORDER BY i."id") AS "ids",
      string_agg(DISTINCT p."key", ', ') AS "projects"
    FROM "records"."items" i JOIN "core"."projects" p ON p."id" = i."project_id"
    GROUP BY i."key" HAVING count(*) > 1
  ) c;
  IF "clash" IS NOT NULL THEN
    RAISE EXCEPTION 'items.key: these keys would name more than one item, since their projects share an item prefix: %. Back up and remove one of the projects, or give it another item_prefix, then migrate again.', "clash";
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "records"."items" ALTER COLUMN "key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "records"."items" ADD CONSTRAINT "items_key_unique" UNIQUE("key");
