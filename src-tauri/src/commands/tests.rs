//! Testes dos comandos (rodam com `cargo test`).

use super::assets::copy_assets;
use super::bundle::export_portable_bundle;
use super::files::{
    delete_folder, gravar_bytes, move_file, preview_file, rename_file, rename_folder,
    unique_md_path,
};
use super::projects::list_markdown;
use super::storage::{argumentos_do_webview, config_de_json, soma_cache, soma_pasta, validar_limite, LIMITES_MB};
use super::trash::{limpar, mover, read_index};
use std::fs;
use std::io::Read;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

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
fn move_documento_entre_pastas_sem_sobrescrever() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let raiz = std::env::temp_dir().join(format!("mdoffice-move-{nonce}"));
    let origem = raiz.join("Markdown");
    let destino = raiz.join("Word");
    fs::create_dir_all(&origem).expect("cria origem");
    fs::create_dir_all(&destino).expect("cria destino");
    let doc = origem.join("notas.md");
    fs::write(&doc, "conteúdo").expect("cria documento");
    // já existe um documento com o mesmo nome no destino: não pode sobrescrever
    fs::write(destino.join("notas.md"), "já existia").expect("cria conflito");

    let novo = move_file(
        doc.to_string_lossy().to_string(),
        destino.to_string_lossy().to_string(),
    )
    .expect("move");
    assert!(novo.ends_with("notas-1.md"), "veio: {novo}");
    assert!(!doc.exists(), "o original saiu da pasta de origem");
    assert_eq!(
        fs::read_to_string(destino.join("notas.md")).expect("lê antigo"),
        "já existia"
    );
    assert_eq!(
        fs::read_to_string(destino.join("notas-1.md")).expect("lê movido"),
        "conteúdo"
    );

    // arrastar para a pasta onde o arquivo já está não muda nada
    let mesmo = move_file(
        destino.join("notas-1.md").to_string_lossy().to_string(),
        destino.to_string_lossy().to_string(),
    )
    .expect("mesma pasta");
    assert!(mesmo.ends_with("notas-1.md"), "veio: {mesmo}");
    fs::remove_dir_all(&raiz).expect("limpa arquivos de teste");
}

#[test]
fn renomeia_pasta_sem_sobrescrever() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let raiz = std::env::temp_dir().join(format!("mdoffice-rename-folder-{nonce}"));
    let pasta = raiz.join("Antiga");
    fs::create_dir_all(&pasta).expect("cria pasta");
    fs::write(pasta.join("doc.md"), "x").expect("cria documento dentro");
    fs::create_dir_all(raiz.join("Nova")).expect("cria conflito");

    let novo = rename_folder(
        pasta.to_string_lossy().to_string(),
        "Nova/Nome?estranho".to_string(),
    )
    .expect("renomeia");
    // o nome é limpo (separadores e "?" viram "-") e a pasta com documentos vai junto
    assert!(novo.ends_with("Nova-Nome-estranho"), "veio: {novo}");
    assert!(Path::new(&novo).join("doc.md").is_file(), "documento foi junto");

    // se a pasta já existe, ganha sufixo em vez de sobrescrever
    let outra = raiz.join("Outra");
    fs::create_dir_all(&outra).expect("cria pasta");
    let novo2 = rename_folder(outra.to_string_lossy().to_string(), "Nova".to_string())
        .expect("renomeia com conflito");
    assert!(novo2.ends_with("Nova-1"), "veio: {novo2}");
    fs::remove_dir_all(&raiz).expect("limpa arquivos de teste");
}

#[test]
fn exclui_pasta_apenas_quando_vazia() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let raiz = std::env::temp_dir().join(format!("mdoffice-delete-folder-{nonce}"));
    let vazia = raiz.join("Vazia");
    let cheia = raiz.join("Cheia");
    fs::create_dir_all(&vazia).expect("cria vazia");
    fs::create_dir_all(&cheia).expect("cria cheia");
    fs::write(cheia.join("doc.md"), "x").expect("cria documento");

    // pasta com documento é recusada: nada é apagado por engano
    assert!(delete_folder(cheia.to_string_lossy().to_string()).is_err());
    assert!(cheia.join("doc.md").is_file(), "o documento continua lá");

    delete_folder(vazia.to_string_lossy().to_string()).expect("apaga a vazia");
    assert!(!vazia.exists(), "a pasta vazia saiu");
    fs::remove_dir_all(&raiz).expect("limpa arquivos de teste");
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

#[test]
fn soma_o_tamanho_de_uma_pasta_recursivamente() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let root = std::env::temp_dir().join(format!("mdoffice-storage-{nonce}"));
    fs::create_dir_all(root.join("a/b")).expect("cria subpastas");
    fs::write(root.join("a/um.bin"), vec![0u8; 10]).expect("cria arquivo");
    fs::write(root.join("a/b/dois.bin"), vec![0u8; 25]).expect("cria arquivo aninhado");

    assert_eq!(soma_pasta(&root), 35);
    assert_eq!(soma_pasta(&root.join("nao-existe")), 0);
    fs::remove_dir_all(&root).expect("limpa arquivos de teste");
}

#[test]
fn a_arvore_do_projeto_lista_as_pastas_e_esconde_o_resto() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let raiz = std::env::temp_dir().join(format!("mdoffice-projetos-{nonce}"));
    // as quatro subpastas padrão do app + uma vazia (a vazia TAMBÉM aparece: é onde se cria
    // uma pasta nova e para onde se arrastam documentos)
    for pasta in ["Markdown", "Word", "Excel", "PowerPoint", "Vazia"] {
        fs::create_dir_all(raiz.join(pasta)).expect("cria a pasta");
    }
    fs::write(raiz.join("Markdown/Documento.md"), "texto").expect("cria md");
    fs::write(raiz.join("Word/Documento.docx"), b"x").expect("cria docx");
    fs::write(raiz.join("Excel/Documento.xlsx"), b"x").expect("cria xlsx");
    fs::write(raiz.join("PowerPoint/Documento.pptx"), b"x").expect("cria pptx");
    fs::write(raiz.join("Excel/Documento.xlsm"), b"x").expect("cria xlsm");
    fs::write(raiz.join("Markdown/LEIA-ME.txt"), "txt").expect("cria txt");
    fs::write(raiz.join("Markdown/imagem.png"), b"x").expect("cria png");

    let arvore = list_markdown(raiz.to_string_lossy().to_string()).expect("lê a árvore");
    let nomes: Vec<&str> = arvore.iter().map(|n| n.name.as_str()).collect();
    assert_eq!(
        nomes,
        vec!["Excel", "Markdown", "PowerPoint", "Vazia", "Word"],
        "as pastas aparecem em ordem, inclusive a vazia"
    );

    let excel: Vec<&str> = arvore[0].children.iter().map(|n| n.name.as_str()).collect();
    assert_eq!(excel, vec!["Documento.xlsm", "Documento.xlsx"], "planilha aparece nos dois formatos");
    let markdown: Vec<&str> = arvore[1].children.iter().map(|n| n.name.as_str()).collect();
    assert_eq!(markdown, vec!["Documento.md"], "txt e imagem não entram na árvore");
    assert!(arvore[3].children.is_empty(), "a pasta vazia vem sem filhos");
    let word: Vec<&str> = arvore[4].children.iter().map(|n| n.name.as_str()).collect();
    assert_eq!(word, vec!["Documento.docx"]);

    fs::remove_dir_all(&raiz).expect("limpa arquivos de teste");
}

#[test]
fn gravar_bytes_nao_gasta_ida_extra_e_cria_a_pasta_quando_falta() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mdoffice-gravar-{nonce}"));

    // 1. pasta inexistente: a gravação cria a pasta (e o arquivo) na segunda tentativa
    let dentro = dir.join("sub").join("notas.md");
    gravar_bytes(&dentro, b"versao 1").expect("cria a pasta e grava");
    assert_eq!(fs::read_to_string(&dentro).expect("lê"), "versao 1");

    // 2. pasta existente: grava por cima sem tocar em mais nada
    gravar_bytes(&dentro, b"versao 2").expect("sobrescreve");
    assert_eq!(fs::read_to_string(&dentro).expect("lê"), "versao 2");

    // 3. pasta apagada por fora no meio da sessão: a próxima gravação recria
    fs::remove_dir_all(dir.join("sub")).expect("apaga a pasta por fora");
    gravar_bytes(&dentro, b"versao 3").expect("recria a pasta");
    assert_eq!(fs::read_to_string(&dentro).expect("lê"), "versao 3");

    // 4. caminho impossível (a "pasta" é um arquivo): o erro de verdade chega ao app
    fs::write(dir.join("bloqueio"), b"nao sou pasta").expect("cria arquivo");
    let erro = gravar_bytes(&dir.join("bloqueio").join("x.md"), b"x").expect_err("recusa");
    assert!(!erro.is_empty(), "o erro precisa chegar para o aviso de 'não salvou'");

    fs::remove_dir_all(&dir).expect("limpa arquivos de teste");
}

#[test]
fn cache_do_webview_argumentos_e_limites() {
    // sem teto (automático) os argumentos ficam só com os padrões do wry
    let padrao = argumentos_do_webview(0);
    assert_eq!(padrao, "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection");
    assert!(!padrao.contains("disk-cache-size"), "automático não impõe teto");

    // com teto, o valor vai em BYTES (o que o Chromium espera) e os padrões continuam junto:
    // passar argumentos substitui o que o wry poria sozinho
    let um_gb = argumentos_do_webview(1024);
    assert!(um_gb.contains("--disk-cache-size=1073741824"), "1 GB em bytes: {um_gb}");
    assert!(um_gb.contains("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection"));
    assert!(argumentos_do_webview(4096).contains("--disk-cache-size=4294967296"), "4 GB em bytes");

    // só as opções da tela passam
    assert_eq!(validar_limite(0).expect("automático"), 0);
    assert_eq!(validar_limite(2048).expect("2 GB"), 2048);
    assert!(validar_limite(999).is_err(), "valor fora da lista é recusado");
    assert_eq!(LIMITES_MB, [0, 512, 1024, 2048, 4096], "as opções são as mesmas da tela");
}

#[test]
fn cache_do_webview_config_tolera_arquivo_ausente_ou_estragado() {
    let padrao = config_de_json("nao sou json");
    assert_eq!((padrao.limite_mb, padrao.aplicado_mb), (0, 0), "lixo vira automático");

    let lido = config_de_json("{\"limite_mb\":1024,\"aplicado_mb\":0}");
    assert_eq!((lido.limite_mb, lido.aplicado_mb), (1024, 0), "o pedido e o que está em uso são campos separados");

    let so_um = config_de_json("{\"limite_mb\":2048}");
    assert_eq!((so_um.limite_mb, so_um.aplicado_mb), (2048, 0), "campo que falta vira 0");
}

#[test]
fn soma_cache_acha_o_cache_do_perfil_e_nao_conta_duas_vezes() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mdoffice-cache-{nonce}"));
    // o perfil de verdade: EBWebView\Default\Cache, Code Cache e Service Worker\CacheStorage
    let perfil = dir.join("EBWebView").join("Default");
    fs::create_dir_all(perfil.join("Cache").join("Cache_Data")).expect("cria o cache de disco");
    fs::write(perfil.join("Cache").join("Cache_Data").join("f_000001"), vec![0u8; 1000]).expect("arquivo do cache");
    fs::create_dir_all(perfil.join("Code Cache").join("js")).expect("cria o cache de código");
    fs::write(perfil.join("Code Cache").join("js").join("dados"), vec![0u8; 200]).expect("arquivo do cache de código");
    fs::create_dir_all(perfil.join("Service Worker").join("CacheStorage")).expect("cria o cache do service worker");
    fs::write(perfil.join("Service Worker").join("CacheStorage").join("x"), vec![0u8; 30]).expect("arquivo do sw");
    fs::create_dir_all(perfil.join("Local Storage")).expect("cria as preferências");
    fs::write(perfil.join("Local Storage").join("leveldb"), vec![0u8; 5000]).expect("arquivo de preferências");

    assert_eq!(
        soma_cache(&dir),
        1230,
        "o cache conta o que está no perfil (Cache, Code Cache e CacheStorage), sem contar duas vezes"
    );
    assert_eq!(
        soma_pasta(&dir),
        6230,
        "a pasta inteira continua contando tudo (preferências inclusive)"
    );

    fs::remove_dir_all(&dir).expect("limpa arquivos de teste");
}

#[test]
fn previa_le_o_comeco_do_texto_do_md_e_dos_pacotes() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("relógio válido")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("mdoffice-previa-{nonce}"));
    fs::create_dir_all(&dir).expect("cria pasta");

    // .md: o começo do texto, como está no arquivo
    let md = dir.join("documento.md");
    fs::write(&md, "# Título do documento\n\nPrimeiro parágrafo do texto.").expect("grava md");
    let p = preview_file(md.to_string_lossy().to_string()).expect("prévia do md");
    assert_eq!(p.tipo, "md");
    assert!(p.texto.starts_with("# Título do documento"), "veio: {}", p.texto);

    // .docx: o zip com o XML principal — o texto sai das tags e os parágrafos viram espaço
    let docx = dir.join("documento.docx");
    {
        use std::io::Write;
        let mut z = zip::ZipWriter::new(fs::File::create(&docx).expect("cria zip"));
        z.start_file("word/document.xml", zip::write::FileOptions::default()).expect("entrada");
        z.write_all(
            "<w:document><w:body><w:p><w:r><w:t>Relatório</w:t></w:r></w:p><w:p><w:r><w:t>de março</w:t></w:r></w:p></w:body></w:document>".as_bytes(),
        )
        .expect("escreve xml");
        z.finish().expect("fecha zip");
    }
    let p = preview_file(docx.to_string_lossy().to_string()).expect("prévia do docx");
    assert_eq!(p.tipo, "docx");
    assert_eq!(p.texto, "Relatório\nde março", "os parágrafos precisam virar linha");

    // .pptx: o mesmo caminho, com o XML da primeira lâmina
    let pptx = dir.join("documento.pptx");
    {
        use std::io::Write;
        let mut z = zip::ZipWriter::new(fs::File::create(&pptx).expect("cria zip"));
        z.start_file("ppt/slides/slide1.xml", zip::write::FileOptions::default()).expect("entrada");
        z.write_all("<p:sld><p:cSld><a:t>Reunião de quinta</a:t><a:t>Pauta</a:t></p:cSld></p:sld>".as_bytes()).expect("escreve xml");
        z.finish().expect("fecha zip");
    }
    let p = preview_file(pptx.to_string_lossy().to_string()).expect("prévia do pptx");
    assert_eq!(p.tipo, "pptx");
    assert_eq!(p.texto, "Reunião de quinta Pauta");

    // arquivo que não é documento: sem texto, mas sem erro (o cartão mostra só o ícone)
    let outro = dir.join("qualquer.bin");
    fs::write(&outro, b"nao e documento").expect("grava binário");
    let p = preview_file(outro.to_string_lossy().to_string()).expect("prévia do outro");
    assert_eq!(p.tipo, "outro");
    assert!(p.texto.is_empty());

    // arquivo que não existe: sem texto (o front cai no cartão sem prévia) — nunca um erro que
    // derrube a tela Início
    let p = preview_file(dir.join("fantasma.docx").to_string_lossy().to_string()).expect("prévia do ausente");
    assert_eq!(p.tipo, "docx");
    assert!(p.texto.is_empty());

    fs::remove_dir_all(&dir).expect("limpa arquivos de teste");
}
