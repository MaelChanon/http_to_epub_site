ALTER TABLE "chapters" DROP COLUMN "uid";
--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "manga_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_manga_provider_number" UNIQUE("manga_id","provider_id","number");
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_chapter_number" UNIQUE("chapter_id","number");
--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_name_key" UNIQUE("name");
