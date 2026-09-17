/* =====================================================================
   Configuração do Supabase.
   ---------------------------------------------------------------------
   Estes dois valores são PÚBLICOS por natureza: a anon key só consegue
   fazer o que as políticas de RLS do banco permitirem — aqui, apenas
   SELECT nas tabelas `projetos` e `skills`.
   NUNCA coloque a chave `service_role` neste arquivo.

   Dá para preencher de duas formas:
   1. Editando os valores abaixo à mão (funciona em qualquer hospedagem);
   2. Definindo SUPABASE_URL e SUPABASE_ANON_KEY como variáveis de
      ambiente na Vercel/Netlify — o script `scripts/build-config.mjs`
      roda no build e reescreve este arquivo com os valores delas.
   ===================================================================== */

window.SUPABASE_CONFIG = {
  url: "https://ezcimturifwwhzujsqvm.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6Y2ltdHVyaWZ3d2h6dWpzcXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NzUzNDYsImV4cCI6MjEwNTI1MTM0Nn0.uEwJPaAwmBD5LAKV1l9WYwFNdFppd5hcbgGLyFwDy8A"
};
