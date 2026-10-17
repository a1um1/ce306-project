ALTER TABLE "expense" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_user_external_idx" ON "expense" USING btree ("user_id","external_id");