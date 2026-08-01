ALTER TABLE "mangas" ADD COLUMN "manga_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "mangas" ADD CONSTRAINT "mangas_manga_id_key" UNIQUE("manga_id");