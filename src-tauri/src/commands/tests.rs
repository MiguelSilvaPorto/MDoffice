//! Testes dos comandos (rodam com `cargo test`).

use super::assets::copy_assets;
use super::bundle::export_portable_bundle;
use super::files::{rename_file, unique_md_path};
use super::projects::scan_folder;
use super::trash::{limpar, mover, read_index};
use std::fs;
use std::io::Read;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn inspeciona_arvore_sem_entrar_em_pastas_de_dependencias() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("mdoffice-tree-{nonce}"));
    fs::create_dir_all(root.join("src/components")).expect("cria subpastas");
    fs::create_dir_all(root.join("node_modules/pacote")).expect("cria pasta ignorada");
    fs::write(root.join("src/main.rs"), "// teste").expect("cria arquivo");
    fs::write(root.join("src/components/editor.ts"), "// teste")
        .expect("cria arquivo aninhado");
    fs::write(root.join("README.md"), "# teste").expect("cria readme");
    fs::write(root.join("node_modules/pacote/index.js"), "// ignorado")
        .expect("cria dependência");

    let snap = scan_folder(&root).expect("estrutura deve ser lida");
    let paths: Vec<_> = snap.entries.iter().map(|e| e.relative.as_str()).collect();
    assert!(paths.contains(&"src"));
    assert!(paths.contains(&"src/main.rs"));
    assert!(paths.contains(&"src/components"));
    assert!(paths.contains(&"src/components/editor.ts"));
    assert!(paths.contains(&"README.md"));
    assert!(!paths.iter().any(|p| p.contains("node_modules")));
    fs::remove_dir_all(&root).expect("limpa arquivos de teste");
}

#[test]
fn copia_assets_ao_sair_do_rascunho_sem_sobrescrever() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let from_dir = std::env::temp_dir().join(format!("mdoffice-assets-from-{nonce}"));
    let to_dir = std::env::temp_dir().join(format!("mdoffice-assets-to-{nonce}"));
    fs::create_dir_all(from_dir.join("assets")).expect("cria assets origem");
    fs::create_dir_all(to_dir.join("assets")).expect("cria assets destino");
    fs::write(from_dir.join("assets/desenho-a.png"), [1u8, 2, 3]).expect("imagem origem");
    fs::write(from_dir.join("assets/desenho-b.json"), b"{\"x\":1}").expect("json origem");
    fs::write(from_dir.join("doc.md"), "origem").expect("doc origem");
    fs::write(to_dir.join("assets/desenho-a.png"), [9u8, 9, 9]).expect("conflito no destino");

    let copied = copy_assets(
        from_dir.join("doc.md").to_string_lossy().to_string(),
        to_dir.join("doc.md").to_string_lossy().to_string(),
    )
    .expect("copia assets");
    assert_eq!(copied, 2);
    assert_eq!(
        fs::read(to_dir.join("assets/desenho-a.png")).expect("lê original"),
        vec![9u8, 9, 9],
        "não pode sobrescrever o arquivo existente"
    );
    assert_eq!(
        fs::read(to_dir.join("assets/desenho-a-1.png")).expect("lê cópia com sufixo"),
        vec![1u8, 2, 3]
    );
    assert_eq!(
        fs::read(to_dir.join("assets/desenho-b.json")).expect("lê json copiado"),
        b"{\"x\":1}"
    );
    fs::remove_dir_all(&from_dir).expect("limpa origem");
    fs::remove_dir_all(&to_dir).expect("limpa destino");
}

#[test]
fn renomeia_documento_sem_sobrescrever() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mdoffice-rename-{nonce}"));
    fs::create_dir_all(&dir).expect("cria pasta");
    let original = dir.join("antigo.md");
    fs::write(&original, "conteúdo").expect("cria arquivo");
    fs::write(dir.join("Novo Nome.md"), "já existia").expect("cria conflito");

    // nome inválido é limpo e ".md" é acrescentado
    let novo = rename_file(
        original.to_string_lossy().to_string(),
        "Novo/Nome?estranho".to_string(),
    )
    .expect("renomeia");
    assert!(novo.ends_with("Novo-Nome-estranho.md"), "veio: {novo}");

    // se o nome já existe, ganha sufixo em vez de sobrescrever
    let arquivo2 = dir.join("outro.md");
    fs::write(&arquivo2, "x").expect("cria arquivo");
    let novo2 = rename_file(
        arquivo2.to_string_lossy().to_string(),
        "Novo Nome.md".to_string(),
    )
    .expect("renomeia com conflito");
    assert!(novo2.ends_with("Novo Nome-1.md"), "veio: {novo2}");
    assert_eq!(
        fs::read_to_string(dir.join("Novo Nome.md")).expect("lê antigo"),
        "já existia"
    );
    fs::remove_dir_all(&dir).expect("limpa arquivos de teste");
}

#[test]
fn sugere_caminho_md_livre_sem_sobrescrever() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mdoffice-mdpath-{nonce}"));
    let first = unique_md_path(
        dir.to_string_lossy().to_string(),
        "Meu Documento Ácido".to_string(),
    )
    .expect("sugere caminho");
    assert!(first.ends_with("meu-documento-acido.md"), "veio: {first}");
    fs::write(&first, "conteúdo").expect("cria arquivo");
    let second = unique_md_path(
        dir.to_string_lossy().to_string(),
        "Meu Documento Ácido".to_string(),
    )
    .expect("sugere caminho livre");
    assert!(
        second.ends_with("meu-documento-acido-1.md"),
        "veio: {second}"
    );
    assert_ne!(first, second);
    fs::remove_dir_all(&dir).expect("limpa arquivos de teste");
}

#[test]
fn pacote_portatil_leva_markdown_imagem_json_e_modelo_de_instrucao() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("mdoffice-bundle-{nonce}"));
    let assets = root.join("assets");
    fs::create_dir_all(&assets).expect("cria pasta assets");
    fs::write(assets.join("desenho-teste.png"), [137, 80, 78, 71])
        .expect("cria imagem de teste");
    fs::write(
        assets.join("desenho-teste.png.draw.json"),
        r#"{"version":1,"elements":[]}"#,
    )
    .expect("cria sidecar do desenho");
    let markdown = "# Brief\n\n![Desenho](assets/desenho-teste.png)\n";
    let doc_path = root.join("brief.md");
    let zip_path = root.join("brief-para-ia.zip");
    fs::write(&doc_path, markdown).expect("cria markdown");

    let count = export_portable_bundle(
        doc_path.to_string_lossy().to_string(),
        markdown.to_string(),
        zip_path.to_string_lossy().to_string(),
    )
    .expect("cria pacote zip");
    assert_eq!(count, 1);

    let file = fs::File::open(&zip_path).expect("abre zip");
    let mut archive = zip::ZipArchive::new(file).expect("zip válido");
    let names: Vec<_> = archive.file_names().map(str::to_string).collect();
    assert!(names.contains(&"brief.md".to_string()));
    assert!(names.contains(&"assets/desenho-teste.png".to_string()));
    assert!(names.contains(&"assets/desenho-teste.png.draw.json".to_string()));
    assert!(names.contains(&"INSTRUCOES_PARA_IA.md".to_string()));

    let mut guide = String::new();
    archive
        .by_name("INSTRUCOES_PARA_IA.md")
        .expect("modelo no ZIP")
        .read_to_string(&mut guide)
        .expect("lê modelo");
    assert!(guide.contains("O que quero que você faça?"));
    assert!(guide.contains("Como quero o resultado?"));
    fs::remove_dir_all(&root).expect("limpa arquivos de teste");
}

#[test]
fn lixeira_move_guarda_e_so_apaga_depois_de_30_dias() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let docs = std::env::temp_dir().join(format!("mdoffice-trash-docs-{nonce}"));
    let root = std::env::temp_dir().join(format!("mdoffice-trash-{nonce}"));
    fs::create_dir_all(&docs).expect("cria pasta de documentos");
    let doc = docs.join("notas.md");
    fs::write(&doc, "# notas").expect("cria documento");

    // instante fixo: o teste não depende do relógio da máquina
    let t0 = 1_000_000_000_000u64;
    let item = mover(&root, &doc, t0).expect("move para a lixeira");
    assert!(!doc.exists(), "o documento sai da pasta original");
    assert!(Path::new(&item.trash_path).exists(), "o arquivo passa a viver na lixeira");
    assert_eq!(item.name, "notas.md", "o nome original é preservado");
    assert!(item.original.to_lowercase().ends_with("notas.md"));

    // ainda dentro do prazo: nada é apagado
    let apagados = limpar(&root, t0 + 29 * 24 * 60 * 60 * 1000).expect("limpeza dentro do prazo");
    assert_eq!(apagados, 0);
    assert!(Path::new(&item.trash_path).exists(), "antes dos 30 dias o arquivo fica");

    // passou dos 30 dias: apagado de vez
    let apagados = limpar(&root, t0 + 31 * 24 * 60 * 60 * 1000).expect("limpeza depois do prazo");
    assert_eq!(apagados, 1);
    assert!(!Path::new(&item.trash_path).exists(), "depois do prazo o arquivo some de vez");
    fs::remove_dir_all(&docs).expect("limpa documentos de teste");
    fs::remove_dir_all(&root).expect("limpa lixeira de teste");
}

#[test]
fn lixeira_nao_sobrescreve_nem_aceita_o_que_ja_esta_na_pasta() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let docs = std::env::temp_dir().join(format!("mdoffice-trash-nomes-{nonce}"));
    let root = std::env::temp_dir().join(format!("mdoffice-trash-root-{nonce}"));
    fs::create_dir_all(&docs).expect("cria pasta de documentos");

    // dois arquivos com o mesmo nome convivem: o segundo ganha sufixo
    let primeiro = docs.join("igual.md");
    fs::write(&primeiro, "primeiro").expect("cria o primeiro");
    let item1 = mover(&root, &primeiro, 1).expect("move o primeiro");
    fs::write(&primeiro, "segundo").expect("cria o segundo");
    let item2 = mover(&root, &primeiro, 2).expect("move o segundo");
    assert_eq!(item1.name, "igual.md");
    assert_eq!(item2.name, "igual-1.md");
    assert_eq!(
        fs::read_to_string(&item1.trash_path).expect("lê o primeiro"),
        "primeiro",
        "não pode sobrescrever o que já estava na lixeira"
    );

    // mover algo que já está dentro da lixeira é recusado (não cria lixo de lixo)
    let erro = mover(&root, Path::new(&item1.trash_path), 3).expect_err("recusa o que já está lá");
    assert!(erro.contains("já está na lixeira"), "veio: {erro}");

    // pasta não é arquivo: recusado
    let erro = mover(&root, &docs, 4).expect_err("recusa pasta");
    assert!(erro.contains("Só dá para mover arquivos"), "veio: {erro}");

    // recuperado por fora (pelo Explorer): sai do índice na próxima limpeza, sem erro
    fs::remove_file(&item2.trash_path).expect("remove por fora");
    let apagados = limpar(&root, 5).expect("limpeza");
    assert_eq!(apagados, 0);
    let lista = read_index(&root);
    assert_eq!(lista.len(), 1, "só o que continua guardado fica no índice");
    assert_eq!(lista[0].name, "igual.md");
    fs::remove_dir_all(&docs).expect("limpa documentos de teste");
    fs::remove_dir_all(&root).expect("limpa lixeira de teste");
}
