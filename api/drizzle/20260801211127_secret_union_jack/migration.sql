CREATE TYPE "manga_format" AS ENUM('SERIES', 'ONE_SHOT', 'NOVEL');--> statement-breakpoint
CREATE TYPE "manga_genre" AS ENUM('ACTION', 'ADVENTURE', 'COMEDY', 'DRAMA', 'ECCHI', 'FANTASY', 'HENTAI', 'HORROR', 'MAHOU_SHOUJO', 'MECHA', 'MUSIC', 'MYSTERY', 'PSYCHOLOGICAL', 'ROMANCE', 'SCI_FI', 'SLICE_OF_LIFE', 'SPORTS', 'SUPERNATURAL', 'THRILLER');--> statement-breakpoint
CREATE TYPE "manga_status" AS ENUM('ONGOING', 'FINISHED', 'CANCELLED', 'HIATUS', 'NOT_YET_RELEASED');--> statement-breakpoint
CREATE TABLE "manga_genres" (
	"manga_id" uuid,
	"genre" "manga_genre",
	CONSTRAINT "manga_genres_pkey" PRIMARY KEY("manga_id","genre")
);
--> statement-breakpoint
CREATE TABLE "manga_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"manga_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mangas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"path" text NOT NULL,
	"title_romaji" text,
	"title_english" text,
	"title_native" text NOT NULL,
	"format" "manga_format" NOT NULL,
	"status" "manga_status" NOT NULL,
	"published_at" date,
	"total_chapters" integer,
	"score" integer,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "manga_genres" ADD CONSTRAINT "manga_genres_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "manga_staff" ADD CONSTRAINT "manga_staff_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;