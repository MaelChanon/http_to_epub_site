CREATE TYPE "permission" AS ENUM('MANGA_METADATA_REFRESH', 'MANGA_PROVIDER_ADD', 'MANGA_PROVIDER_REFRESH', 'MANGA_PROVIDER_DELETE');--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" uuid,
	"permission" "permission",
	CONSTRAINT "user_permissions_pkey" PRIMARY KEY("user_id","permission")
);
--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;