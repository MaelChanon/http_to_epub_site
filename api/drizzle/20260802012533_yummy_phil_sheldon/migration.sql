CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"uid" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manga_providers" (
	"manga_id" uuid,
	"provider_id" uuid,
	CONSTRAINT "manga_providers_pkey" PRIMARY KEY("manga_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"chapter_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "manga_providers" ADD CONSTRAINT "manga_providers_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "manga_providers" ADD CONSTRAINT "manga_providers_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_chapter_id_chapters_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE;