CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"pseudo" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL
);
