// Teste de contrato da lixeira (roda com `node scripts/testar-lixeira.mts`).
//
// O comportamento de verdade — mover, não sobrescrever, apagar só depois de 30 dias —
// é testado em `cargo test` (src-tauri/src/commands/tests.rs). Aqui confere-se o
// CONTRATO: os comandos que o frontend chama existem no Rust, estão registrados, o
// prazo é 30 dias e o menu/confirmação estão ligados como o resto do app espera.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const checa = (nome: string, ok: boolean, falhou = "") => {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}${!ok && falhou ? ` — ${falhou}` : ""}`);
  if (!ok) falhas++;
};

console.log("lixeira (frontend ↔ Rust)");

const rust = readFileSync(join(raiz, "src-tauri/src/commands/trash.rs"), "utf8");
const lib = readFileSync(join(raiz, "src-tauri/src/lib.rs"), "utf8");
const files = readFileSync(join(raiz, "src/files.ts"), "utf8");

// os comandos que o frontend chama precisam existir no Rust, registrados e com ponte no TS
for (const c of ["trash_move", "trash_purge"]) {
  checa(`comando ${c}`, rust.includes(`pub fn ${c}`), "não existe em trash.rs");
  checa(`registro ${c}`, lib.includes(`commands::trash::${c}`), "não registrado em lib.rs");
  checa(`ponte ${c}`, files.includes(`"${c}"`), "files.ts não chama o comando");
}

// o prazo de retenção é fixo em 30 dias
checa("retenção de 30 dias", rust.includes("RETENTION_DAYS: u64 = 30"), "prazo diferente de 30 dias");

// o menu do arquivo ganhou a ação
const menus = readFileSync(join(raiz, "src/app/menus.ts"), "utf8");
checa("item no menu do arquivo", menus.includes("Mover para a lixeira"), "menu sem a ação");
checa("o item chama a ação", menus.includes("moveToTrash(path)"), "item não chama moveToTrash");

// o clique direito e o botão "⋯" usam o MESMO menu
const sidebar = readFileSync(join(raiz, "src/sidebar.ts"), "utf8");
checa("clique direito unificado", sidebar.includes("fileMenuAt(e.clientX, e.clientY"), "sidebar ainda tem menu próprio");
const app = readFileSync(join(raiz, "src/app/app.ts"), "utf8");
checa("hook fileMenuAt ligado", app.includes("fileMenuAt: (x, y, path) =>"), "app.ts sem o hook");

// a confirmação avisa o que vai acontecer e a abertura limpa o que venceu
const trashTs = readFileSync(join(raiz, "src/app/trash.ts"), "utf8");
checa("confirmação antes de mover", trashTs.includes("Mover para a lixeira?"), "sem diálogo de confirmação");
checa("confirmação explica o prazo", trashTs.includes("30 dias"), "diálogo sem o prazo");
checa("abertura limpa a lixeira", app.includes("purgeTrash()"), "app não limpa a lixeira na abertura");

// o aviso de "arquivo sumiu" do backup conhece a lixeira (não reclama do que foi movido de propósito)
const backup = readFileSync(join(raiz, "src-tauri/src/commands/backup.rs"), "utf8");
checa("backup conhece a lixeira", backup.includes("trashed_paths"), "backup_missing sem o filtro");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
