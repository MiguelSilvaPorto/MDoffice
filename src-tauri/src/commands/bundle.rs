//! Pacote portátil para IA (.zip): Markdown + imagens locais + desenhos editáveis + instruções.

use super::util::io_err;
use std::fs;
use std::io::Write;
use std::path::{Component, Path};
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Extrai os destinos das imagens Markdown sem interpretar nem executar HTML.
fn markdown_image_targets(markdown: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let mut cursor = 0;
    while let Some(start) = markdown[cursor..].find("![") {
        let absolute_start = cursor + start;
        let Some(label_end_rel) = markdown[absolute_start + 2..].find("](") else {
            cursor = absolute_start + 2;
            continue;
        };
        let dest_start = absolute_start + 2 + label_end_rel + 2;
        let Some(dest_end_rel) = markdown[dest_start..].find(')') else {
            cursor = dest_start;
            continue;
        };
        let raw = markdown[dest_start..dest_start + dest_end_rel].trim();
        let mut target = raw.split_whitespace().next().unwrap_or("").trim();
        if target.starts_with('<') && target.ends_with('>') && target.len() >= 2 {
            target = &target[1..target.len() - 1];
        }
        if !target.is_empty() && !targets.iter().any(|existing| existing == target) {
            targets.push(target.to_string());
        }
        cursor = dest_start + dest_end_rel + 1;
    }
    targets
}

fn add_zip_file(zip: &mut ZipWriter<fs::File>, name: &str, bytes: &[u8]) -> Result<(), String> {
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
    zip.start_file(name.replace('\\', "/"), options)
        .map_err(|e| e.to_string())?;
    zip.write_all(bytes).map_err(io_err)
}

/// Cria um único ZIP portátil com o Markdown, suas imagens locais referenciadas,
/// JSONs editáveis dos desenhos e uma folha simples de orientação para a IA.
#[tauri::command]
pub fn export_portable_bundle(
    doc_path: String,
    content: String,
    output_path: String,
) -> Result<usize, String> {
    let doc = Path::new(&doc_path);
    let parent = doc
        .parent()
        .ok_or_else(|| "Salve o Markdown em uma pasta antes de exportar o pacote.".to_string())?;
    let doc_name = doc
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "Nome do documento inválido.".to_string())?;

    let output = fs::File::create(&output_path).map_err(io_err)?;
    let mut zip = ZipWriter::new(output);
    add_zip_file(&mut zip, &doc_name, content.as_bytes())?;

    let mut bundled_images = 0usize;
    let mut bundled_sidecars = 0usize;
    for target in markdown_image_targets(&content) {
        // Data URLs já estão dentro do Markdown; imagens web continuam acessíveis pela rede.
        if target.starts_with("data:")
            || target.starts_with("https://")
            || target.starts_with("http://")
        {
            continue;
        }
        let rel_path = Path::new(&target);
        if rel_path.is_absolute()
            || rel_path
                .components()
                .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)))
        {
            return Err(format!(
                "A imagem '{target}' está fora da pasta do documento. Mova-a para assets/ antes de exportar."
            ));
        }
        let source = parent.join(rel_path);
        if !source.is_file() {
            return Err(format!(
                "A imagem '{target}' não foi encontrada. O pacote não foi finalizado."
            ));
        }
        let bytes = fs::read(&source).map_err(io_err)?;
        add_zip_file(&mut zip, &target, &bytes)?;
        bundled_images += 1;

        // O sidecar preserva a possibilidade de editar desenhos após descompactar.
        let sidecar_rel = format!("{target}.draw.json");
        let sidecar_path = parent.join(&sidecar_rel);
        if sidecar_path.is_file() {
            let sidecar = fs::read(sidecar_path).map_err(io_err)?;
            add_zip_file(&mut zip, &sidecar_rel, &sidecar)?;
            bundled_sidecars += 1;
        }
    }

    let instructions = format!(
        "# Instruções para a IA\n\nEste pacote contém o documento `{doc_name}` e {bundled_images} imagem(ns) local(is) referenciada(s) por ele. Os desenhos editáveis também incluem {bundled_sidecars} arquivo(s) JSON auxiliar(es). Imagens externas (URLs HTTP/HTTPS) não são copiadas; elas precisam de internet.\n\n## O que quero que você faça?\nDescreva a tarefa de forma direta.\n\n## Como quero o resultado?\n- Formato da resposta:\n- Tom e nível de detalhe:\n- Estrutura desejada:\n\n## Contexto e critérios\n- O que é importante manter:\n- Restrições ou exemplos:\n\nAbra o Markdown e considere as imagens incluídas no diretório `assets/` como referências visuais.\n"
    );
    add_zip_file(&mut zip, "INSTRUCOES_PARA_IA.md", instructions.as_bytes())?;
    zip.finish().map_err(|e| e.to_string())?;
    Ok(bundled_images)
}
