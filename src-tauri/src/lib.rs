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
            commands::files::load_text,
            commands::files::save_text,
            commands::assets::asset_copy,
            commands::assets::asset_write,
            commands::files::read_file_data_url,
            commands::drafts::default_docs_dir,
            commands::files::unique_md_path,
            commands::projects::inspect_folders,
            commands::assets::asset_update,
            commands::files::rename_file,
            commands::drafts::list_drafts,
            commands::drafts::draft_path,
            commands::drafts::delete_draft,
            commands::assets::copy_assets,
            commands::bundle::export_portable_bundle,
            commands::projects::list_markdown,
            commands::files::create_folder,
            commands::files::save_binary,
            commands::search::search_markdown,
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
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o mdCreator");
}
