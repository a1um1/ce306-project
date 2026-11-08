CREATE TABLE "line_event" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" json NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "line_event_webhook_event_id_unique" UNIQUE("webhook_event_id")
);
--> statement-breakpoint
CREATE TABLE "line_link" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"line_user_id" text NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "line_link_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE "line_link_code" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "type" text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "raw_text" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "line_link" ADD CONSTRAINT "line_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_link_code" ADD CONSTRAINT "line_link_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;