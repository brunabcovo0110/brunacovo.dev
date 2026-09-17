/* =====================================================================
   build-config.mjs
   ---------------------------------------------------------------------
   Gera assets/js/config.js a partir das variáveis de ambiente
   SUPABASE_URL e SUPABASE_ANON_KEY.

   Roda no build da Vercel/Netlify. Se as variáveis não estiverem
   definidas, o arquivo existente é mantido como está — assim o site
   continua funcionando com os valores commitados.

   Uso local:  node scripts/build-config.mjs
   ===================================================================== */

import { writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "assets/js/config.js");

const url = process.env.SUPABASE_URL?.trim();
const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  if (existsSync(target)) {
    console.log("[build-config] SUPABASE_URL/SUPABASE_ANON_KEY não definidas.");
    console.log("[build-config] Mantendo o assets/js/config.js existente.");
    process.exit(0);
  }
  console.error("[build-config] ERRO: variáveis ausentes e config.js não existe.");
  console.error("[build-config] Defina SUPABASE_URL e SUPABASE_ANON_KEY.");
  process.exit(1);
}

// A anon key é um JWT (ou sb_publishable_...). Se alguém colar a
// service_role por engano, o build para: ela não pode ir para o navegador.
if (/service_role/.test(anonKey)) {
  console.error("[build-config] ERRO: isso parece ser a chave service_role.");
  console.error("[build-config] Use a chave anon (pública). A service_role ignora o RLS.");
  process.exit(1);
}

const file = `/* Gerado por scripts/build-config.mjs — não edite à mão no deploy. */
window.SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;

writeFileSync(target, file, "utf8");
console.log(`[build-config] assets/js/config.js gerado para ${url}`);
