// Teste do backup: a política (perfis, carimbo, tamanhos) e o contrato da ponte.
//
// Até a W3 metade deste teste lia o `backup.rs` e conferia nomes de funções/atributos do
// Rust. Com o app 100% TypeScript, o contrato passou a ser outro: todo comando `backup_*`
// (e os de arquivo/rascunho) que o app chama precisa existir na ponte (`src/ponte/index.ts`),
// que é quem traduz para a camada de disco. O comportamento do backup em si é exercitado no
// navegador (`npm run app`).
//
// Uso: npx tsx scripts/testar-backup.mts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const checa = (nome: string, ok: boolean, falhou = "") => {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}${!ok && falhou ? ` — ${falhou}` : ""}`);
  if (!ok) falhas++;
};

console.log("contrato da ponte (o app ↔ a camada de disco)");

const ponte = readFileSync(join(raiz, "src/ponte/index.ts"), "utf8");
const fontes = ["src/backup.ts", "src/files.ts"].map((f) => readFileSync(join(raiz, f), "utf8"));

// todo comando chamado pelo app precisa ter um `case` na ponte
const comandos = [
  ...new Set(
    fontes.flatMap((fonte) => [...fonte.matchAll(/invoke(?:<[^>]*>)?\("([a-z_]+)"/g)].map((m) => m[1]))
  ),
];
for (const c of comandos) {
  checa(`comando ${c}`, ponte.includes(`case "${c}"`), "não existe na ponte");
}

// o backup em disco do navegador guarda o estado anterior antes de sobrescrever
const backupDisco = readFileSync(join(raiz, "src/disco/backup.ts"), "utf8");
checa("o backup protege o estado anterior (.orig)", backupDisco.includes(".orig"), "sem a proteção");
checa("o backup não grava cópia repetida", backupDisco.includes("mesmosBytes"), "sem a comparação");

// os perfis e a conversão perfil -> política (a ponte entre a interface e o disco)
const { PERFIS, numerosDoPerfil, carimbo, diaDeHoje, tamanhoLegivel } = await import("../src/backupPolicy.ts");

const porId = (id: string) => PERFIS.find((p) => p.id === id)!;
checa("perfil Leve na lista", !!porId("leve"), "faltou o perfil leve");
checa("perfil Equilibrado na lista", !!porId("equilibrado"));
checa("perfil Máximo na lista", !!porId("maximo"));
checa("perfil Personalizado na lista", !!porId("personalizado"));

checa("Equilibrado = 50 cópias / 30 dias", porId("equilibrado").copias === 50 && porId("equilibrado").dias === 30);
checa("Leve = 10 cópias / 7 dias", porId("leve").copias === 10 && porId("leve").dias === 7);
checa("Máximo = 200 cópias / 1 ano", porId("maximo").copias === 200 && porId("maximo").dias === 365);
checa("sem teto de espaço em nenhum perfil", !PERFIS.some((p) => "gb" in p || "bytes" in p), "apareceu limite de espaço");

// perfil pronto ignora os números personalizados
checa("perfil pronto usa os números dele", numerosDoPerfil("leve", 999, 999).copias === 10);
// personalizado usa o que o usuário escolheu
checa(
  "personalizado usa o que foi escolhido",
  numerosDoPerfil("personalizado", 123, 45).copias === 123 && numerosDoPerfil("personalizado", 123, 45).dias === 45
);
// "sem limite" (0) é aceito e chega ao Rust como 0
checa("personalizado aceita 0 (sem limite)", numerosDoPerfil("personalizado", 0, 0).copias === 0);

// o carimbo é um nome de arquivo válido
const c = carimbo();
checa("carimbo no formato do backup", /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(c), c);
const d = diaDeHoje();
checa("dia de hoje no formato certo", /^\d{4}-\d{2}-\d{2}$/.test(d), d);

// os tamanhos aparecem legíveis na interface
checa("tamanho em KB", tamanhoLegivel(2048) === "2 KB", tamanhoLegivel(2048));
checa("tamanho em MB", tamanhoLegivel(5 * 1024 * 1024) === "5.0 MB", tamanhoLegivel(5 * 1024 * 1024));
checa("tamanho em GB", tamanhoLegivel(3 * 1024 * 1024 * 1024) === "3.00 GB", tamanhoLegivel(3 * 1024 * 1024 * 1024));

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);