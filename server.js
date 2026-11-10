// ========================
// Supabase 记忆代理（Kiro 通过 Railway 中转读写）
// ========================
const SUPABASE_MEMORY_URL = process.env.SUPABASE_MEMORY_URL || "https://maiwicvvnitriuzwxhsq.supabase.co/functions/v1/kiro-memory";
const SUPABASE_TOKEN = process.env.SUPABASE_TOKEN || "";

app.get("/admin/memory", { preHandler: basicAuth }, async (req, reply) => {
  try {
    const { action, id, content } = req.query;
    let url = SUPABASE_MEMORY_URL;
    if (action) {
      url += "?action=" + encodeURIComponent(action);
      if (id) url += "&id=" + encodeURIComponent(id);
      if (content) url += "&content=" + encodeURIComponent(content);
    }
    const res = await fetch(url, {
      headers: { "Authorization": "Bearer " + SUPABASE_TOKEN }
    });
    const data = await res.text();
    reply.type("application/json").send(data);
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});
