CREATE TABLE "agent_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"tool_alias" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_connections" ADD COLUMN "display_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_connections" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_connections" ADD CONSTRAINT "agent_connections_connection_id_tool_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."tool_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_connections" DROP COLUMN "name";