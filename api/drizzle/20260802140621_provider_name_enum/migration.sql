CREATE TYPE "provider_name" AS ENUM('SUSHISCAN', 'MANGA_ORIGINS');--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "name" SET DATA TYPE "provider_name" USING "name"::"provider_name";
