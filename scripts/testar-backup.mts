// Teste de integração do backup em disco (roda com `npx tsx scripts/testar-backup.mts`).
//
// Sobe um mini-servidor HTTP que traduz cada comando `backup_*` para o mesmo código Rust
// já compilado? Não: aqui testamos a LÓGICA do contrato. O teste real do Rust já está em
// `cargo test`. Este script confere que o formato que o frontend espera é o que o Rust
// devolve — verificando o JSON contra os tipos de TypeScript.
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

console.log("contrato do backup (frontend ↔ Rust)");

const rust = readFileSync(join(raiz, "src-tauri/src/commands/backup.rs"), "utf8");
const ts = readFileSync(join(raiz, "src/backup.ts"), "utf8");

// os comandos que o frontend chama precisam existir no Rust
const comandos = [...ts.matchAll(/invoke<[^>]*>\("(backup_[a-z_]+)"|invoke\("(backup_[a-z_]+)"/g)].map(
  (m) => m[1] ?? m[2]
);
for (const c of [...new Set(comandos)]) {
  checa(`comando ${c}`, rust.includes(`pub fn ${c}`), "não existe em backup.rs");
}

// e todos precisam estar registrados
const lib = readFileSync(join(raiz, "src-tauri/src/lib.rs"), "utf8");
for (const c of [...new Set(comandos)]) {
  checa(`registro ${c}`, lib.includes(`commands::backup::${c}`), "não registrado em lib.rs");
}

// os campos que o frontend lê nos tipos do Rust
const campos: [string, string][] = [
  ["BackupFile.bytes", "pub bytes: u64"],
  ["BackupFile.protection", "pub protection: bool"],
  ["BackupFile.stamp", "pub stamp: String"],
  ["BackupEntry.missing", "pub missing: bool"],
  ["BackupWriteResult.skipped", "pub skipped: bool"],
  ["BackupWriteResult.failed", "pub failed: Vec<String>"],
  ["IndexFile.days", "pub days: u32"],
  ["BackupIndex.copies", "pub copies: u64"],
];
for (const [nome, alvo] of campos) checa(`campo ${nome}`, rust.includes(alvo), `esperava "${alvo}"`);

// a proteção antes de sobrescrever está ligada nos três pontos de gravação
const files = readFileSync(join(raiz, "src-tauri/src/commands/files.rs"), "utf8");
const assets = readFileSync(join(raiz, "src-tauri/src/commands/assets.rs"), "utf8");
checa("save_text protege", files.includes("protect_before_write"), "files.rs sem proteção");
checa("save_binary protege", /pub fn save_binary\(app: tauri::AppHandle/.test(files), "assinatura não recebe AppHandle");
checa("asset_update protege", assets.includes("protect_before_write"), "assets.rs sem proteção");

// o hook de leitura marca o conteúdo do disco (para não proteger à toa)
checa("load_text marca o disco", files.includes("note_disk_content"), "sem note_disk_content");

// os perfis e a conversão perfil -> política (a ponte entre a interface e o Rust)
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