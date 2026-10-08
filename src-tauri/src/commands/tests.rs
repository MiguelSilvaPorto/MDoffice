//! Testes dos comandos (rodam com `cargo test`).

use super::assets::copy_assets;
use super::bundle::export_portable_bundle;
use super::files::{rename_file, unique_md_path};
use super::projects::scan_folder;
use std::fs;
use std::io::Read;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn inspeciona_arvore_sem_entrar_em_pastas_de_dependencias() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("mdcreator-tree-{nonce}"));
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
    let from_dir = std::env::temp_dir().join(format!("mdcreator-assets-from-{nonce}"));
    let to_dir = std::env::temp_dir().join(format!("mdcreator-assets-to-{nonce}"));
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
    let dir = std::env::temp_dir().join(format!("mdcreator-rename-{nonce}"));
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
    let dir = std::env::temp_dir().join(format!("mdcreator-mdpath-{nonce}"));
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
    let root = std::env::temp_dir().join(format!("mdcreator-bundle-{nonce}"));
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
