CREATE TABLE "ActivityLog" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Agency" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logoUrl" text,
	"country" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updatedAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CardMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"cardId" text NOT NULL,
	"sender" text NOT NULL,
	"message" text NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ChangeRequest" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"scopeCardId" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"clientRequest" text NOT NULL,
	"agencyResponse" text,
	"additionalEffort" text,
	"additionalCost" real,
	"timelineImpactDays" integer DEFAULT 0,
	"internalNotes" text,
	"clientFeedback" text,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updatedAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EmailVerification" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expiresAt" text NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MagicLink" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updatedAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "MagicLink_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"agencyId" text NOT NULL,
	"projectId" text NOT NULL,
	"content" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"clientName" text NOT NULL,
	"clientEmail" text NOT NULL,
	"clientCompany" text,
	"clientWhatsApp" text,
	"type" text DEFAULT 'SOFTWARE' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"sowText" text,
	"sowUrl" text,
	"signOffRecord" text,
	"signedAt" text,
	"agencyId" text NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updatedAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ScopeCard" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"sectionId" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Feature' NOT NULL,
	"effort" text,
	"included" text NOT NULL,
	"excluded" text,
	"type" text DEFAULT 'IN_SCOPE' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updatedAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Section" (
	"id" text PRIMARY KEY NOT NULL,
	"projectId" text NOT NULL,
	"title" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updatedAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TeamMember" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"passwordHash" text NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"agencyId" text NOT NULL,
	"isVerified" boolean DEFAULT false NOT NULL,
	"createdAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updatedAt" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "TeamMember_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "CardMessage" ADD CONSTRAINT "CardMessage_cardId_ScopeCard_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."ScopeCard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_scopeCardId_ScopeCard_id_fk" FOREIGN KEY ("scopeCardId") REFERENCES "public"."ScopeCard"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_agencyId_Agency_id_fk" FOREIGN KEY ("agencyId") REFERENCES "public"."Agency"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ScopeCard" ADD CONSTRAINT "ScopeCard_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ScopeCard" ADD CONSTRAINT "ScopeCard_sectionId_Section_id_fk" FOREIGN KEY ("sectionId") REFERENCES "public"."Section"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Section" ADD CONSTRAINT "Section_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_agencyId_Agency_id_fk" FOREIGN KEY ("agencyId") REFERENCES "public"."Agency"("id") ON DELETE cascade ON UPDATE no action;