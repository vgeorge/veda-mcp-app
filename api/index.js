// Vercel function entry: the whole Express app as one function. Imports the
// compiled server so dist/*.html resolves the same way as `npm run start:prod`.
import { createApp } from "../dist/server/app.js";
import { validateConfig } from "../dist/server/config.js";
import { createServer } from "../dist/server/server.js";

validateConfig();

export default createApp(createServer);
