CREATE TABLE "comment_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_comment_user_emoji" UNIQUE("comment_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "ticket_type_child_types" (
	"parent_type_id" integer NOT NULL,
	"child_type_id" integer NOT NULL,
	CONSTRAINT "ticket_type_child_types_parent_type_id_child_type_id_pk" PRIMARY KEY("parent_type_id","child_type_id")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_child_types" ADD CONSTRAINT "ticket_type_child_types_parent_type_id_ticket_types_id_fk" FOREIGN KEY ("parent_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_child_types" ADD CONSTRAINT "ticket_type_child_types_child_type_id_ticket_types_id_fk" FOREIGN KEY ("child_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reactions_comment" ON "comment_reactions" USING btree ("comment_id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_parent" ON "comments" USING btree ("parent_id");--> statement-breakpoint
-- data backfill: promote the existing ticket_types.config.allowedChildTypes jsonb
-- (array of child type keys) into first-class ticket_type_child_types rows,
-- resolving keys to ids within each parent's scheme. Idempotent.
INSERT INTO "ticket_type_child_types" ("parent_type_id", "child_type_id")
SELECT p."id", c."id"
FROM "ticket_types" p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p."config" -> 'allowedChildTypes', '[]'::jsonb)) AS ck(child_key)
JOIN "ticket_types" c ON c."scheme_id" = p."scheme_id" AND c."key" = ck.child_key
ON CONFLICT DO NOTHING;