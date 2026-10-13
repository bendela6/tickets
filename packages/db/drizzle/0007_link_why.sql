-- TK-80.5: a link says why it is there; a plan's blocker must.
ALTER TABLE "records"."item_links" ADD COLUMN "why" text;--> statement-breakpoint
-- A plan scheme seeded before blockers existed gets them here, as the seed
-- makes them: every type owns a `blocks` link type (source blocks target)
-- that targets every type of its scheme.
INSERT INTO "structure"."link_types" ("item_type_id", "key", "label", "inverse_label", "directional", "position")
SELECT t."id", 'blocks', 'Blocks', 'Blocked by', true, 0
FROM "structure"."item_types" t
JOIN "structure"."schemes" s ON s."id" = t."scheme_id"
WHERE s."config" @> '{"plan": true}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM "structure"."link_types" l WHERE l."item_type_id" = t."id" AND l."key" = 'blocks'
  );--> statement-breakpoint
INSERT INTO "structure"."link_type_target_types" ("link_type_id", "target_type_id")
SELECT l."id", target."id"
FROM "structure"."link_types" l
JOIN "structure"."item_types" owner ON owner."id" = l."item_type_id"
JOIN "structure"."schemes" s ON s."id" = owner."scheme_id"
JOIN "structure"."item_types" target ON target."scheme_id" = s."id"
WHERE s."config" @> '{"plan": true}'::jsonb AND l."key" = 'blocks'
ON CONFLICT DO NOTHING;
