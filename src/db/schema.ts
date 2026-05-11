import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

// ─── Agency ──────────────────────────────────────────────────────────────────
export const agency = sqliteTable("Agency", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  logoUrl:   text("logoUrl"),
  country:   text("country"),
  currency:  text("currency").notNull().default("USD"),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updatedAt").notNull().default(sql`(datetime('now'))`),
});

// ─── TeamMember ───────────────────────────────────────────────────────────────
export const teamMember = sqliteTable("TeamMember", {
  id:           text("id").primaryKey(),
  email:        text("email").notNull().unique(),
  name:         text("name").notNull(),
  passwordHash: text("passwordHash").notNull(),
  role:         text("role").notNull().default("MEMBER"),
  agencyId:     text("agencyId").notNull().references(() => agency.id, { onDelete: "cascade" }),
  isVerified:   integer("isVerified", { mode: "boolean" }).notNull().default(false),
  createdAt:    text("createdAt").notNull().default(sql`(datetime('now'))`),
  updatedAt:    text("updatedAt").notNull().default(sql`(datetime('now'))`),
});

// ─── Project ──────────────────────────────────────────────────────────────────
export const project = sqliteTable("Project", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull(),
  clientName:     text("clientName").notNull(),
  clientEmail:    text("clientEmail").notNull(),
  clientCompany:  text("clientCompany"),
  clientWhatsApp: text("clientWhatsApp"),
  type:           text("type").notNull().default("SOFTWARE"),
  currency:       text("currency").notNull().default("USD"),
  status:         text("status").notNull().default("DRAFT"),
  sowText:        text("sowText"),
  sowUrl:         text("sowUrl"),
  signOffRecord:  text("signOffRecord"),
  signedAt:       text("signedAt"),
  agencyId:       text("agencyId").notNull(),
  createdAt:      text("createdAt").notNull().default(sql`(datetime('now'))`),
  updatedAt:      text("updatedAt").notNull().default(sql`(datetime('now'))`),
});

// ─── Section ──────────────────────────────────────────────────────────────────
export const section = sqliteTable("Section", {
  id:        text("id").primaryKey(),
  projectId: text("projectId").notNull().references(() => project.id, { onDelete: "cascade" }),
  title:     text("title").notNull(),
  order:     integer("order").notNull().default(0),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updatedAt").notNull().default(sql`(datetime('now'))`),
});

// ─── ScopeCard ────────────────────────────────────────────────────────────────
export const scopeCard = sqliteTable("ScopeCard", {
  id:          text("id").primaryKey(),
  projectId:   text("projectId").notNull().references(() => project.id, { onDelete: "cascade" }),
  sectionId:   text("sectionId").references(() => section.id, { onDelete: "set null" }),
  title:       text("title").notNull(),
  description: text("description").notNull(),
  icon:        text("icon").notNull().default("Feature"),
  effort:      text("effort"),
  included:    text("included").notNull(),
  excluded:    text("excluded"),
  type:        text("type").notNull().default("IN_SCOPE"),
  status:      text("status").notNull().default("PENDING"),
  order:       integer("order").notNull().default(0),
  createdAt:   text("createdAt").notNull().default(sql`(datetime('now'))`),
  updatedAt:   text("updatedAt").notNull().default(sql`(datetime('now'))`),
});

// ─── CardMessage ──────────────────────────────────────────────────────────────
export const cardMessage = sqliteTable("CardMessage", {
  id:        text("id").primaryKey(),
  cardId:    text("cardId").notNull().references(() => scopeCard.id, { onDelete: "cascade" }),
  sender:    text("sender").notNull(), // "CLIENT" | "AGENCY"
  message:   text("message").notNull(),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
});

// ─── MagicLink ────────────────────────────────────────────────────────────────
export const magicLink = sqliteTable("MagicLink", {
  id:        text("id").primaryKey(),
  projectId: text("projectId").notNull().references(() => project.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: text("expiresAt").notNull(),
  isActive:  integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updatedAt").notNull().default(sql`(datetime('now'))`),
});

// ─── ActivityLog ──────────────────────────────────────────────────────────────
export const activityLog = sqliteTable("ActivityLog", {
  id:        text("id").primaryKey(),
  projectId: text("projectId").notNull().references(() => project.id, { onDelete: "cascade" }),
  action:    text("action").notNull(),
  details:   text("details").notNull(),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
});

// ─── Notification ─────────────────────────────────────────────────────────────
export const notification = sqliteTable("Notification", {
  id:        text("id").primaryKey(),
  agencyId:  text("agencyId").notNull().references(() => agency.id, { onDelete: "cascade" }),
  projectId: text("projectId").notNull().references(() => project.id, { onDelete: "cascade" }),
  content:   text("content").notNull(),
  isRead:    integer("isRead", { mode: "boolean" }).notNull().default(false),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
});

// ─── ChangeRequest ────────────────────────────────────────────────────────────
export const changeRequest = sqliteTable("ChangeRequest", {
  id:                  text("id").primaryKey(),
  projectId:           text("projectId").notNull().references(() => project.id, { onDelete: "cascade" }),
  scopeCardId:         text("scopeCardId").references(() => scopeCard.id, { onDelete: "set null" }),
  status:              text("status").notNull().default("NEW"),
  clientRequest:       text("clientRequest").notNull(),
  agencyResponse:      text("agencyResponse"),
  additionalEffort:    text("additionalEffort"),
  additionalCost:      real("additionalCost"),
  timelineImpactDays:  integer("timelineImpactDays").default(0),
  internalNotes:       text("internalNotes"),
  clientFeedback:      text("clientFeedback"),
  createdAt:           text("createdAt").notNull().default(sql`(datetime('now'))`),
  updatedAt:           text("updatedAt").notNull().default(sql`(datetime('now'))`),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const agencyRelations = relations(agency, ({ many }) => ({
  members: many(teamMember),
  projects: many(project),
  notifications: many(notification),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  agency: one(agency, {
    fields: [teamMember.agencyId],
    references: [agency.id],
  }),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  agency: one(agency, {
    fields: [project.agencyId],
    references: [agency.id],
  }),
  sections: many(section),
  scopeCards: many(scopeCard),
  magicLinks: many(magicLink),
  activityLogs: many(activityLog),
  notifications: many(notification),
  changeRequests: many(changeRequest),
}));

export const sectionRelations = relations(section, ({ one, many }) => ({
  project: one(project, {
    fields: [section.projectId],
    references: [project.id],
  }),
  scopeCards: many(scopeCard),
}));

export const scopeCardRelations = relations(scopeCard, ({ one, many }) => ({
  project: one(project, {
    fields: [scopeCard.projectId],
    references: [project.id],
  }),
  section: one(section, {
    fields: [scopeCard.sectionId],
    references: [section.id],
  }),
  messages: many(cardMessage),
  changeRequests: many(changeRequest),
}));

export const cardMessageRelations = relations(cardMessage, ({ one }) => ({
  card: one(scopeCard, {
    fields: [cardMessage.cardId],
    references: [scopeCard.id],
  }),
}));

export const magicLinkRelations = relations(magicLink, ({ one }) => ({
  project: one(project, {
    fields: [magicLink.projectId],
    references: [project.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  project: one(project, {
    fields: [activityLog.projectId],
    references: [project.id],
  }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  agency: one(agency, {
    fields: [notification.agencyId],
    references: [agency.id],
  }),
  project: one(project, {
    fields: [notification.projectId],
    references: [project.id],
  }),
}));

export const changeRequestRelations = relations(changeRequest, ({ one }) => ({
  project: one(project, {
    fields: [changeRequest.projectId],
    references: [project.id],
  }),
  scopeCard: one(scopeCard, {
    fields: [changeRequest.scopeCardId],
    references: [scopeCard.id],
  }),
}));

// ─── Type exports ─────────────────────────────────────────────────────────────
export type Agency         = typeof agency.$inferSelect;
export type TeamMember     = typeof teamMember.$inferSelect;
export type Project        = typeof project.$inferSelect;
export type Section        = typeof section.$inferSelect;
export type ScopeCard      = typeof scopeCard.$inferSelect;
export type MagicLink      = typeof magicLink.$inferSelect;
export type ActivityLog    = typeof activityLog.$inferSelect;
export type Notification   = typeof notification.$inferSelect;
export type ChangeRequest  = typeof changeRequest.$inferSelect;
export type CardMessage    = typeof cardMessage.$inferSelect;

// ─── EmailVerification ────────────────────────────────────────────────────────
export const emailVerification = sqliteTable("EmailVerification", {
  id:        text("id").primaryKey(),
  email:     text("email").notNull(),
  code:      text("code").notNull(),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull().default(sql`(datetime('now'))`),
});

export type EmailVerification = typeof emailVerification.$inferSelect;

