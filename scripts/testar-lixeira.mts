// Teste de contrato da lixeira (roda com `node scripts/testar-lixeira.mts`).
//
// O comportamento de verdade (mover, não sobrescrever, apagar só depois de 30 dias) é
// exercitado no navegador; aqui confere-se o CONTRATO: a lixeira vive em `.mdoffice/lixeira`,
// o prazo é 30 dias, a ponte atende os comandos e o menu/confirmação estão ligados como o
// resto do app espera.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const checa = (nome: string, ok: boolean, falhou = "") => {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}${!ok && falhou ? ` — ${falhou}` : ""}`);
  if (!ok) falhas++;
};

console.log("lixeira (a camada de disco do navegador)");

const lixeira = readFileSync(join(raiz, "src/disco/lixeira.ts"), "utf8");
const ponte = readFileSync(join(raiz, "src/ponte/index.ts"), "utf8");
const files = readFileSync(join(raiz, "src/files.ts"), "utf8");

// os comandos que o frontend chama precisam existir na ponte e ser chamados por files.ts
for (const c of ["trash_move", "trash_purge"]) {
  checa(`comando ${c}`, files.includes(`"${c}"`), "files.ts não chama o comando");
  checa(`ponte ${c}`, ponte.includes(`case "${c}"`), "a ponte não atende o comando");
}

// o prazo de retenção é fixo em 30 dias e a pasta é a do app, dentro da pasta concedida
checa("retenção de 30 dias", /RETENCAO_DIAS\s*=\s*30/.test(lixeira), "prazo diferente de 30 dias");
checa("a lixeira fica em .mdoffice", lixeira.includes(`".mdoffice"`) || lixeira.includes('PASTA = "lixeira"'), "pasta diferente");
checa("há um índice dos itens", lixeira.includes("index.json") || lixeira.includes("INDICE"), "sem índice");
checa("mover tira o documento do registro", lixeira.includes("apagarDocumento"), "o id continua registrado");

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
const backup = readFileSync(join(raiz, "src/disco/backup.ts"), "utf8");
checa("backup conhece a lixeira", backup.includes("originaisNaLixeira"), "backup_missing sem o filtro");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
