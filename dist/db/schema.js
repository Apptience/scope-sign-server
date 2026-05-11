"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailVerification = exports.changeRequestRelations = exports.notificationRelations = exports.activityLogRelations = exports.magicLinkRelations = exports.cardMessageRelations = exports.scopeCardRelations = exports.sectionRelations = exports.projectRelations = exports.teamMemberRelations = exports.agencyRelations = exports.changeRequest = exports.notification = exports.activityLog = exports.magicLink = exports.cardMessage = exports.scopeCard = exports.section = exports.project = exports.teamMember = exports.agency = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const drizzle_orm_1 = require("drizzle-orm");
// ─── Agency ──────────────────────────────────────────────────────────────────
exports.agency = (0, sqlite_core_1.sqliteTable)("Agency", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    logoUrl: (0, sqlite_core_1.text)("logoUrl"),
    country: (0, sqlite_core_1.text)("country"),
    currency: (0, sqlite_core_1.text)("currency").notNull().default("USD"),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
    updatedAt: (0, sqlite_core_1.text)("updatedAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── TeamMember ───────────────────────────────────────────────────────────────
exports.teamMember = (0, sqlite_core_1.sqliteTable)("TeamMember", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    email: (0, sqlite_core_1.text)("email").notNull().unique(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    passwordHash: (0, sqlite_core_1.text)("passwordHash").notNull(),
    role: (0, sqlite_core_1.text)("role").notNull().default("MEMBER"),
    agencyId: (0, sqlite_core_1.text)("agencyId").notNull().references(() => exports.agency.id, { onDelete: "cascade" }),
    isVerified: (0, sqlite_core_1.integer)("isVerified", { mode: "boolean" }).notNull().default(false),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
    updatedAt: (0, sqlite_core_1.text)("updatedAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── Project ──────────────────────────────────────────────────────────────────
exports.project = (0, sqlite_core_1.sqliteTable)("Project", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    name: (0, sqlite_core_1.text)("name").notNull(),
    clientName: (0, sqlite_core_1.text)("clientName").notNull(),
    clientEmail: (0, sqlite_core_1.text)("clientEmail").notNull(),
    clientCompany: (0, sqlite_core_1.text)("clientCompany"),
    clientWhatsApp: (0, sqlite_core_1.text)("clientWhatsApp"),
    type: (0, sqlite_core_1.text)("type").notNull().default("SOFTWARE"),
    currency: (0, sqlite_core_1.text)("currency").notNull().default("USD"),
    status: (0, sqlite_core_1.text)("status").notNull().default("DRAFT"),
    sowText: (0, sqlite_core_1.text)("sowText"),
    sowUrl: (0, sqlite_core_1.text)("sowUrl"),
    signOffRecord: (0, sqlite_core_1.text)("signOffRecord"),
    signedAt: (0, sqlite_core_1.text)("signedAt"),
    agencyId: (0, sqlite_core_1.text)("agencyId").notNull(),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
    updatedAt: (0, sqlite_core_1.text)("updatedAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── Section ──────────────────────────────────────────────────────────────────
exports.section = (0, sqlite_core_1.sqliteTable)("Section", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    projectId: (0, sqlite_core_1.text)("projectId").notNull().references(() => exports.project.id, { onDelete: "cascade" }),
    title: (0, sqlite_core_1.text)("title").notNull(),
    order: (0, sqlite_core_1.integer)("order").notNull().default(0),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
    updatedAt: (0, sqlite_core_1.text)("updatedAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── ScopeCard ────────────────────────────────────────────────────────────────
exports.scopeCard = (0, sqlite_core_1.sqliteTable)("ScopeCard", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    projectId: (0, sqlite_core_1.text)("projectId").notNull().references(() => exports.project.id, { onDelete: "cascade" }),
    sectionId: (0, sqlite_core_1.text)("sectionId").references(() => exports.section.id, { onDelete: "set null" }),
    title: (0, sqlite_core_1.text)("title").notNull(),
    description: (0, sqlite_core_1.text)("description").notNull(),
    icon: (0, sqlite_core_1.text)("icon").notNull().default("Feature"),
    effort: (0, sqlite_core_1.text)("effort"),
    included: (0, sqlite_core_1.text)("included").notNull(),
    excluded: (0, sqlite_core_1.text)("excluded"),
    type: (0, sqlite_core_1.text)("type").notNull().default("IN_SCOPE"),
    status: (0, sqlite_core_1.text)("status").notNull().default("PENDING"),
    order: (0, sqlite_core_1.integer)("order").notNull().default(0),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
    updatedAt: (0, sqlite_core_1.text)("updatedAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── CardMessage ──────────────────────────────────────────────────────────────
exports.cardMessage = (0, sqlite_core_1.sqliteTable)("CardMessage", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    cardId: (0, sqlite_core_1.text)("cardId").notNull().references(() => exports.scopeCard.id, { onDelete: "cascade" }),
    sender: (0, sqlite_core_1.text)("sender").notNull(), // "CLIENT" | "AGENCY"
    message: (0, sqlite_core_1.text)("message").notNull(),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── MagicLink ────────────────────────────────────────────────────────────────
exports.magicLink = (0, sqlite_core_1.sqliteTable)("MagicLink", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    projectId: (0, sqlite_core_1.text)("projectId").notNull().references(() => exports.project.id, { onDelete: "cascade" }),
    token: (0, sqlite_core_1.text)("token").notNull().unique(),
    expiresAt: (0, sqlite_core_1.text)("expiresAt").notNull(),
    isActive: (0, sqlite_core_1.integer)("isActive", { mode: "boolean" }).notNull().default(true),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
    updatedAt: (0, sqlite_core_1.text)("updatedAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── ActivityLog ──────────────────────────────────────────────────────────────
exports.activityLog = (0, sqlite_core_1.sqliteTable)("ActivityLog", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    projectId: (0, sqlite_core_1.text)("projectId").notNull().references(() => exports.project.id, { onDelete: "cascade" }),
    action: (0, sqlite_core_1.text)("action").notNull(),
    details: (0, sqlite_core_1.text)("details").notNull(),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── Notification ─────────────────────────────────────────────────────────────
exports.notification = (0, sqlite_core_1.sqliteTable)("Notification", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    agencyId: (0, sqlite_core_1.text)("agencyId").notNull().references(() => exports.agency.id, { onDelete: "cascade" }),
    projectId: (0, sqlite_core_1.text)("projectId").notNull().references(() => exports.project.id, { onDelete: "cascade" }),
    content: (0, sqlite_core_1.text)("content").notNull(),
    isRead: (0, sqlite_core_1.integer)("isRead", { mode: "boolean" }).notNull().default(false),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── ChangeRequest ────────────────────────────────────────────────────────────
exports.changeRequest = (0, sqlite_core_1.sqliteTable)("ChangeRequest", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    projectId: (0, sqlite_core_1.text)("projectId").notNull().references(() => exports.project.id, { onDelete: "cascade" }),
    scopeCardId: (0, sqlite_core_1.text)("scopeCardId").references(() => exports.scopeCard.id, { onDelete: "set null" }),
    status: (0, sqlite_core_1.text)("status").notNull().default("NEW"),
    clientRequest: (0, sqlite_core_1.text)("clientRequest").notNull(),
    agencyResponse: (0, sqlite_core_1.text)("agencyResponse"),
    additionalEffort: (0, sqlite_core_1.text)("additionalEffort"),
    additionalCost: (0, sqlite_core_1.real)("additionalCost"),
    timelineImpactDays: (0, sqlite_core_1.integer)("timelineImpactDays").default(0),
    internalNotes: (0, sqlite_core_1.text)("internalNotes"),
    clientFeedback: (0, sqlite_core_1.text)("clientFeedback"),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
    updatedAt: (0, sqlite_core_1.text)("updatedAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
// ─── Relations ────────────────────────────────────────────────────────────────
exports.agencyRelations = (0, drizzle_orm_1.relations)(exports.agency, ({ many }) => ({
    members: many(exports.teamMember),
    projects: many(exports.project),
    notifications: many(exports.notification),
}));
exports.teamMemberRelations = (0, drizzle_orm_1.relations)(exports.teamMember, ({ one }) => ({
    agency: one(exports.agency, {
        fields: [exports.teamMember.agencyId],
        references: [exports.agency.id],
    }),
}));
exports.projectRelations = (0, drizzle_orm_1.relations)(exports.project, ({ one, many }) => ({
    agency: one(exports.agency, {
        fields: [exports.project.agencyId],
        references: [exports.agency.id],
    }),
    sections: many(exports.section),
    scopeCards: many(exports.scopeCard),
    magicLinks: many(exports.magicLink),
    activityLogs: many(exports.activityLog),
    notifications: many(exports.notification),
    changeRequests: many(exports.changeRequest),
}));
exports.sectionRelations = (0, drizzle_orm_1.relations)(exports.section, ({ one, many }) => ({
    project: one(exports.project, {
        fields: [exports.section.projectId],
        references: [exports.project.id],
    }),
    scopeCards: many(exports.scopeCard),
}));
exports.scopeCardRelations = (0, drizzle_orm_1.relations)(exports.scopeCard, ({ one, many }) => ({
    project: one(exports.project, {
        fields: [exports.scopeCard.projectId],
        references: [exports.project.id],
    }),
    section: one(exports.section, {
        fields: [exports.scopeCard.sectionId],
        references: [exports.section.id],
    }),
    messages: many(exports.cardMessage),
    changeRequests: many(exports.changeRequest),
}));
exports.cardMessageRelations = (0, drizzle_orm_1.relations)(exports.cardMessage, ({ one }) => ({
    card: one(exports.scopeCard, {
        fields: [exports.cardMessage.cardId],
        references: [exports.scopeCard.id],
    }),
}));
exports.magicLinkRelations = (0, drizzle_orm_1.relations)(exports.magicLink, ({ one }) => ({
    project: one(exports.project, {
        fields: [exports.magicLink.projectId],
        references: [exports.project.id],
    }),
}));
exports.activityLogRelations = (0, drizzle_orm_1.relations)(exports.activityLog, ({ one }) => ({
    project: one(exports.project, {
        fields: [exports.activityLog.projectId],
        references: [exports.project.id],
    }),
}));
exports.notificationRelations = (0, drizzle_orm_1.relations)(exports.notification, ({ one }) => ({
    agency: one(exports.agency, {
        fields: [exports.notification.agencyId],
        references: [exports.agency.id],
    }),
    project: one(exports.project, {
        fields: [exports.notification.projectId],
        references: [exports.project.id],
    }),
}));
exports.changeRequestRelations = (0, drizzle_orm_1.relations)(exports.changeRequest, ({ one }) => ({
    project: one(exports.project, {
        fields: [exports.changeRequest.projectId],
        references: [exports.project.id],
    }),
    scopeCard: one(exports.scopeCard, {
        fields: [exports.changeRequest.scopeCardId],
        references: [exports.scopeCard.id],
    }),
}));
// ─── EmailVerification ────────────────────────────────────────────────────────
exports.emailVerification = (0, sqlite_core_1.sqliteTable)("EmailVerification", {
    id: (0, sqlite_core_1.text)("id").primaryKey(),
    email: (0, sqlite_core_1.text)("email").notNull(),
    code: (0, sqlite_core_1.text)("code").notNull(),
    expiresAt: (0, sqlite_core_1.text)("expiresAt").notNull(),
    createdAt: (0, sqlite_core_1.text)("createdAt").notNull().default((0, drizzle_orm_1.sql) `(datetime('now'))`),
});
