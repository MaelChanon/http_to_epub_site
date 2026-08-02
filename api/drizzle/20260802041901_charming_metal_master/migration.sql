CREATE TABLE "provider_mangas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_mangas_provider_tag" UNIQUE("provider_id","tag")
);
ALTER TABLE "provider_mangas" ADD CONSTRAINT "provider_mangas_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;