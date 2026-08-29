-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "app_language" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "registration_policy" AS ENUM ('open', 'invite_only', 'domain_restricted');

-- CreateEnum
CREATE TYPE "comment_state" AS ENUM ('published', 'pending', 'deleted');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "display_name" VARCHAR(80) NOT NULL,
    "avatar_url" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "status" "user_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "language" "app_language",
    "notify_on_comment" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_status_change" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "registration_policy" "registration_policy" NOT NULL DEFAULT 'open',
    "allowed_email_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comments_require_approval" BOOLEAN NOT NULL DEFAULT false,
    "signup_limit_count" INTEGER NOT NULL DEFAULT 20,
    "signup_limit_minutes" INTEGER NOT NULL DEFAULT 60,
    "submission_limit_count" INTEGER NOT NULL DEFAULT 10,
    "submission_limit_minutes" INTEGER NOT NULL DEFAULT 60,
    "vote_limit_count" INTEGER NOT NULL DEFAULT 100,
    "vote_limit_minutes" INTEGER NOT NULL DEFAULT 60,
    "feature_comments_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "color" VARCHAR(9) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statuses" (
    "id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "color" VARCHAR(9) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_requests" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "status_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "state" "comment_state" NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_external_id_key" ON "users"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_created_at_idx" ON "categories"("is_active", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_name_key" ON "statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_slug_key" ON "statuses"("slug");

-- CreateIndex
CREATE INDEX "statuses_is_active_created_at_idx" ON "statuses"("is_active", "created_at");

-- CreateIndex
CREATE INDEX "feedback_requests_status_id_idx" ON "feedback_requests"("status_id");

-- CreateIndex
CREATE INDEX "feedback_requests_category_id_idx" ON "feedback_requests"("category_id");

-- CreateIndex
CREATE INDEX "feedback_requests_created_at_idx" ON "feedback_requests"("created_at");

-- CreateIndex
CREATE INDEX "feedback_requests_is_pinned_pinned_at_idx" ON "feedback_requests"("is_pinned", "pinned_at");

-- CreateIndex
CREATE INDEX "feedback_requests_author_id_created_at_idx" ON "feedback_requests"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "votes_request_id_idx" ON "votes"("request_id");

-- CreateIndex
CREATE INDEX "votes_user_id_created_at_idx" ON "votes"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "votes_request_id_user_id_key" ON "votes"("request_id", "user_id");

-- CreateIndex
CREATE INDEX "comments_request_id_created_at_id_idx" ON "comments"("request_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "comments_request_id_state_idx" ON "comments"("request_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_email_key" ON "invitations"("email");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "feedback_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "feedback_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- The promises Prisma's schema language cannot express.
--
-- Every one of these is a promise from SRS part 14 whose "who stops it" column
-- says Database. A check in code and a check in the database are not the same
-- strength when two things happen in the same second (R-115, R-145). Each has
-- an integration test that proves the database refuses.
-- ---------------------------------------------------------------------------

-- R-47: exactly one status is the first one. A partial unique index means the
-- database itself refuses a second default, so marking a new one must un-mark
-- the old one in the same step.
CREATE UNIQUE INDEX "statuses_one_default" ON "statuses" ("is_default") WHERE "is_default";

-- R-44: two categories or two statuses can never have the same name, even with
-- different capital letters.
CREATE UNIQUE INDEX "categories_name_lower_key" ON "categories" (lower("name"));
CREATE UNIQUE INDEX "statuses_name_lower_key" ON "statuses" (lower("name"));

-- app_settings holds exactly one row (SRS 12.3). Without this, a second row
-- could appear and the app would read whichever it found first.
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_single_row" CHECK ("id" = 1);

-- R-130: every limit field is needed and the smallest value is 1. Zero would
-- mean nobody can write at all, so the database refuses it outright.
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_limits_positive" CHECK (
  "signup_limit_count" >= 1 AND "signup_limit_minutes" >= 1 AND
  "submission_limit_count" >= 1 AND "submission_limit_minutes" >= 1 AND
  "vote_limit_count" >= 1 AND "vote_limit_minutes" >= 1
);

-- R-67: allowed email domains are kept in small letters, so the domain rule
-- cannot be dodged with a capital letter.
-- Written by joining the list rather than unnesting it: Postgres does not allow
-- a subquery inside a CHECK constraint.
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_domains_lowercase" CHECK (
  array_to_string("allowed_email_domains", ',') =
  lower(array_to_string("allowed_email_domains", ','))
);

-- R-12: title 5 to 120 letters, description 10 to 5000. The upper bound on the
-- title is already the column type; these add the lower bounds and the cap on
-- the description, which has no column-level length.
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_title_length" CHECK (
  char_length(btrim("title")) BETWEEN 5 AND 120
);
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_description_length" CHECK (
  char_length(btrim("description")) BETWEEN 10 AND 5000
);

-- R-32, R-38, R-39: a comment is 1 to 2000 letters while it is readable, and
-- empty once deleted — the text is gone for good, but the row stays so the
-- thread still makes sense.
ALTER TABLE "comments" ADD CONSTRAINT "comments_body_matches_state" CHECK (
  ("state" = 'deleted' AND "body" = '') OR
  ("state" <> 'deleted' AND char_length(btrim("body")) BETWEEN 1 AND 2000)
);

-- A deleted comment records when, and only a deleted comment does.
ALTER TABLE "comments" ADD CONSTRAINT "comments_deleted_at_matches_state" CHECK (
  ("state" = 'deleted') = ("deleted_at" IS NOT NULL)
);

-- R-61: a wiped account keeps its row so its writing survives as "Deleted user",
-- and records when it was wiped.
ALTER TABLE "users" ADD CONSTRAINT "users_deleted_at_matches_status" CHECK (
  ("status" = 'deleted') = ("deleted_at" IS NOT NULL)
);

-- R-54: a display name is 1 to 80 letters. The cap is the column type.
ALTER TABLE "users" ADD CONSTRAINT "users_display_name_present" CHECK (
  char_length(btrim("display_name")) >= 1
);

-- R-23: a pinned request records when it was pinned, so pinned ones keep a
-- fixed order; an unpinned one carries no stale timestamp.
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_pinned_at_matches_flag" CHECK (
  "is_pinned" = ("pinned_at" IS NOT NULL)
);
