use tauri::Manager;

mod commands;

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
            commands::load_text,
            commands::save_text,
            commands::asset_copy,
            commands::asset_write,
            commands::read_file_data_url,
            commands::default_docs_dir,
            commands::unique_md_path,
            commands::inspect_folders,
            commands::asset_update,
            commands::rename_file,
            commands::list_drafts,
            commands::draft_path,
            commands::delete_draft,
            commands::copy_assets,
            commands::export_portable_bundle,
            commands::list_markdown,
            commands::create_folder,
            commands::save_binary,
            commands::search_markdown,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o mdCreator");
}
