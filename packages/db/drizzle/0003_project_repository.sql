-- A project names its repository (TK-92.1): the git link, the same for
-- everyone, and the branch work lands on. Each developer's checkout stays on
-- their machine, never here.
ALTER TABLE "core"."projects" ADD COLUMN "repository_url" text;--> statement-breakpoint
ALTER TABLE "core"."projects" ADD COLUMN "default_branch" text;--> statement-breakpoint
ALTER TABLE "core"."projects" ADD CONSTRAINT "projects_branch_needs_repository" CHECK (default_branch IS NULL OR repository_url IS NOT NULL);
