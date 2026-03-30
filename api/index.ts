import app from "../src/index";

// Vercel serverless function entry point
// Elysia's .fetch is a standard Web API fetch handler (Request -> Response)
export default app.fetch;
