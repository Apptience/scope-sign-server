"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const trpc_1 = require("../trpc");
const auth_1 = require("./auth");
const changeRequest_1 = require("./changeRequest");
const client_1 = require("./client");
const magicLink_1 = require("./magicLink");
const project_1 = require("./project");
const scopeCard_1 = require("./scopeCard");
exports.appRouter = (0, trpc_1.router)({
    auth: auth_1.authRouter,
    project: project_1.projectRouter,
    scopeCard: scopeCard_1.scopeCardRouter,
    magicLink: magicLink_1.magicLinkRouter,
    client: client_1.clientRouter,
    changeRequest: changeRequest_1.changeRequestRouter,
});
