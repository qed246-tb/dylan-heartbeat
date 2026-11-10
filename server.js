// ========================
// Supabase 记忆代理（Kiro 通过 Railway 中转读写）
// ========================
const SUPABASE_MEMORY_URL =
  process.env.SUPABASE_MEMORY_URL ||
  "https://maiwicvvnitriuzwxhsq.supabase.co/functions/v1/kiro-memory";
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || "";

app.get("/admin/memory", { preHandler: basicAuth }, async (req, reply) => {
  try {
    if (!SUPABASE_TOKEN) {
      return reply.code(500).send({ error: "SUPABASE_TOKEN 未配置" });
    }

    const target = new URL(SUPABASE_MEMORY_URL);
    const { action, id, content } = req.query;

    if (action != null) target.searchParams.set("action", String(action));
    if (id != null) target.searchParams.set("id", String(id));
    if (content != null) target.searchParams.set("content", String(content));

    const res = await fetch(target, {
      headers: { Authorization: `Bearer ${SUPABASE_TOKEN}` }
    });

    const responseText = await res.text();
    const contentType = res.headers.get("content-type");

    if (contentType) {
      reply.type(contentType);
    }

    return reply.code(res.status).send(responseText);
  } catch (err) {
    if (req.log) {
      req.log.error({ err }, "Supabase memory proxy failed");
    }
    return reply.code(502).send({ error: "记忆服务暂时不可用" });
  }
});
