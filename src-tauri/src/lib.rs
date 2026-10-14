use tauri::Manager;

mod commands;

/// O identificador do app mudou (`com.mdcreator.desktop` → `com.mdoffice.desktop`), e com
/// ele a pasta de dados (`%LOCALAPPDATA%\...`). Na primeira execução com o nome novo,
/// copia a pasta antiga (rascunhos, backups e preferências do WebView) para a nova.
///
/// Roda no `main`, ANTES do Tauri criar a janela: depois disso a pasta nova já existiria
/// (criada pelo WebView) e a cópia não teria como acontecer.
pub fn migrar_pasta_de_dados() {
    #[cfg(windows)]
    {
        let Ok(base) = std::env::var("LOCALAPPDATA") else { return };
        let base = std::path::PathBuf::from(base);
        let antiga = base.join("com.mdcreator.desktop");
        let nova = base.join("com.mdoffice.desktop");
        if nova.exists() || !antiga.exists() {
            return;
        }
        let _ = copiar_pasta_de_dados(&antiga, &nova);
    }
}

/// Cópia recursiva de melhor esforço: o que estiver travado/estranho é ignorado.
#[cfg(windows)]
fn copiar_pasta_de_dados(de: &std::path::Path, para: &std::path::Path) -> std::io::Result<()> {
    // cache do WebView não vai: é o grosso do tamanho e se recria sozinho
    const PULAR: [&str; 5] = ["Cache", "Code Cache", "GPUCache", "ShaderCache", "CacheStorage"];
    std::fs::create_dir_all(para)?;
    for item in std::fs::read_dir(de)? {
        let Ok(item) = item else { continue };
        let nome = item.file_name();
        let nome_txt = nome.to_string_lossy();
        if PULAR.iter().any(|p| p.eq_ignore_ascii_case(&nome_txt)) {
            continue;
        }
        let destino = para.join(&nome);
        if item.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            let _ = copiar_pasta_de_dados(&item.path(), &destino);
        } else {
            let _ = std::fs::copy(item.path(), &destino);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            for (_, win) in app.webview_windows() {
                let _ = win.set_decorations(false);
                let _ = win.set_shadow(true);
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::files::load_text,
            commands::files::save_text,
            commands::assets::asset_copy,
            commands::assets::asset_write,
            commands::files::read_file_data_url,
            commands::drafts::default_docs_dir,
            commands::files::unique_md_path,
            commands::assets::asset_update,
            commands::files::rename_file,
            commands::drafts::list_drafts,
            commands::drafts::drafts_folder_path,
            commands::drafts::draft_path,
            commands::drafts::delete_draft,
            commands::assets::copy_assets,
            commands::bundle::export_portable_bundle,
            commands::projects::list_markdown,
            commands::files::create_folder,
            commands::files::save_binary,
            commands::search::search_markdown,
            commands::trash::trash_move,
            commands::trash::trash_purge,
            commands::backup::backup_config,
            commands::backup::backup_save_config,
            commands::backup::backup_app_root,
            commands::backup::backup_prepare_root,
            commands::backup::backup_roots,
            commands::backup::backup_write,
            commands::backup::backup_list,
            commands::backup::backup_restore,
            commands::backup::backup_delete,
            commands::backup::backup_prune,
            commands::backup::backup_forget,
            commands::backup::backup_index,
            commands::backup::backup_missing,
            commands::backup::backup_aged,
            commands::backup::backup_save_history,
            commands::backup::backup_load_history,
            commands::backup::backup_clear_history,
            commands::storage::storage_report,
            commands::storage::storage_remove_legacy,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o mdOffice");
}
