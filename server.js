// ========================
// Supabase 记忆代理（Kiro 通过 Railway 中转读写）
// ========================
const SUPABASE_MEMORY_URL = "https://maiwicvvnitriuzwxhsq.supabase.co/functions/v1/kiro-memory";
const SUPABASE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haXdpY3Z2bml0cml1end4aHNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk3Njg5OSwiZXhwIjoyMTAyNTUyODk5fQ.5vYx1rRBfGAintaJRZf9l1nely0va3P4gGazx8OHO5g";

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
