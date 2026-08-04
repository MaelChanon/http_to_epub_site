CREATE TYPE "manga_format" AS ENUM('SERIES', 'ONE_SHOT', 'NOVEL');--> statement-breakpoint
CREATE TYPE "manga_genre" AS ENUM('ACTION', 'ADVENTURE', 'COMEDY', 'DRAMA', 'ECCHI', 'FANTASY', 'HENTAI', 'HORROR', 'MAHOU_SHOUJO', 'MECHA', 'MUSIC', 'MYSTERY', 'PSYCHOLOGICAL', 'ROMANCE', 'SCI_FI', 'SLICE_OF_LIFE', 'SPORTS', 'SUPERNATURAL', 'THRILLER');--> statement-breakpoint
CREATE TYPE "manga_status" AS ENUM('ONGOING', 'FINISHED', 'CANCELLED', 'HIATUS', 'NOT_YET_RELEASED');--> statement-breakpoint
CREATE TYPE "provider_name" AS ENUM('SUSHISCAN', 'MANGA_ORIGINS');--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid,
	"manga_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_pkey" PRIMARY KEY("user_id","manga_id")
);
--> statement-breakpoint
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
	"manga_id" integer NOT NULL UNIQUE,
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
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"manga_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapters_manga_provider_number" UNIQUE("manga_id","provider_id","number")
);
--> statement-breakpoint
CREATE TABLE "manga_providers" (
	"manga_id" uuid,
	"provider_id" uuid,
	"tag" text NOT NULL,
	CONSTRAINT "manga_providers_pkey" PRIMARY KEY("manga_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"chapter_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"path" text NOT NULL,
	CONSTRAINT "pages_chapter_number" UNIQUE("chapter_id","number")
);
--> statement-breakpoint
CREATE TABLE "provider_mangas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_mangas_provider_tag" UNIQUE("provider_id","tag")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" "provider_name" NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pseudo" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "manga_genres" ADD CONSTRAINT "manga_genres_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "manga_staff" ADD CONSTRAINT "manga_staff_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "manga_providers" ADD CONSTRAINT "manga_providers_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "manga_providers" ADD CONSTRAINT "manga_providers_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_chapter_id_chapters_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_mangas" ADD CONSTRAINT "provider_mangas_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;