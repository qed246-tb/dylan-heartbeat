// Emergency, minimal Gateway restoration. Secrets are read only from Railway Variables.
require("dotenv").config({ quiet: true });

const Fastify = require("fastify");
const { decideRequestAccess } = require("./network_access");

const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });
const PORT = Number(process.env.PORT) || 3000;
const IS_RAILWAY_RUNTIME = Boolean(
  process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID
);
const SUPABASE_MEMORY_URL = process.env.SUPABASE_MEMORY_URL ||
  "https://maiwicvvnitriuzwxhsq.supabase.co/functions/v1/kiro-memory";
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || "";

function readBooleanEnv(key) {
  return ["1", "true", "yes", "on"].includes(String(process.env[key] || "").trim().toLowerCase());
}

function basicAuth(req, reply, done) {
  const [scheme, encoded] = String(req.headers.authorization || "").split(" ");
  if (scheme !== "Basic" || !encoded) {
    reply.code(401).header("WWW-Authenticate", 'Basic realm="Admin"').send("Unauthorized");
    return;
  }
  const decoded = Buffer.from(encoded, "base64").toString();
  const colon = decoded.indexOf(":");
  if (colon >= 0 && decoded.slice(0, colon) === process.env.ADMIN_USER &&
      decoded.slice(colon + 1) === process.env.ADMIN_PASSWORD) return done();
  reply.code(401).header("WWW-Authenticate", 'Basic realm="Admin"').send("Unauthorized");
}

app.addHook("onRequest", (req, reply, done) => {
  const requestPath = req.url.split("?")[0];
  const access = decideRequestAccess({
    path: requestPath,
    ip: String(req.ip || req.socket.remoteAddress || ""),
    isRailway: IS_RAILWAY_RUNTIME,
    allowPublicApi: readBooleanEnv("ALLOW_PUBLIC_API"),
    configuredKey: process.env.GATEWAY_API_KEY || "",
    authorization: req.headers.authorization,
    headerKey: req.headers["x-gateway-api-key"] || req.headers["x-api-key"] || ""
  });
  if (access.allow) return done();
  reply.code(access.status || 403).send(access.status === 401 ? { error: access.error } : access.error);
});

app.get("/healthz", async () => ({ status: "ok" }));

app.get("/v1/models", async (req, reply) => {
  return reply.send({
    object: "list",
    data: [{ id: process.env.MODEL_NAME || "gateway-model", object: "model", created: 0, owned_by: "gateway" }]
  });
});

app.post("/v1/chat/completions", async (req, reply) => {
  const targetUrl = process.env.TARGET_API_URL;
  const targetKey = process.env.TARGET_API_KEY;
  if (!targetUrl || !targetKey) {
    return reply.code(500).send({ error: "TARGET_API_URL / TARGET_API_KEY 未配置" });
  }
  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${targetKey}` },
      body: JSON.stringify(req.body)
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    if (req.body?.stream === true && upstream.body) {
      reply.raw.writeHead(upstream.status, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      });
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
      return reply.raw.end();
    }
    return reply.code(upstream.status).type(contentType).send(await upstream.text());
  } catch (err) {
    req.log.error({ err }, "LLM upstream request failed");
    return reply.code(502).send({ error: "上游模型服务暂时不可用" });
  }
});

app.get("/admin/memory", { preHandler: basicAuth }, async (req, reply) => {
  if (!SUPABASE_TOKEN) return reply.code(500).send({ error: "SUPABASE_TOKEN 未配置" });
  try {
    const target = new URL(SUPABASE_MEMORY_URL);
    const { action, id, content } = req.query || {};
    if (action != null) target.searchParams.set("action", String(action));
    if (id != null) target.searchParams.set("id", String(id));
    if (content != null) target.searchParams.set("content", String(content));
    const upstream = await fetch(target, { headers: { Authorization: `Bearer ${SUPABASE_TOKEN}` } });
    const type = upstream.headers.get("content-type");
    if (type) reply.type(type);
    return reply.code(upstream.status).send(await upstream.text());
  } catch (err) {
    req.log.error({ err }, "Supabase memory proxy failed");
    return reply.code(502).send({ error: "记忆服务暂时不可用" });
  }
});

app.listen({ port: PORT, host: "0.0.0.0" }, err => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Gateway listening on port ${PORT}`);
});
