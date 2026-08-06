CREATE TYPE "epub_status" AS ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED');--> statement-breakpoint
CREATE TABLE "epubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"manga_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"chapter_start" integer NOT NULL,
	"chapter_end" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"split_double_page" boolean DEFAULT false NOT NULL,
	"creator" text NOT NULL,
	"filename" text NOT NULL,
	"s3_key" text NOT NULL,
	"status" "epub_status" DEFAULT 'PENDING'::"epub_status" NOT NULL,
	"error_message" text,
	"file_size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "epubs" ADD CONSTRAINT "epubs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "epubs" ADD CONSTRAINT "epubs_manga_id_mangas_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "mangas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "epubs" ADD CONSTRAINT "epubs_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;