// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // a pasta de dados mudou de nome junto com o app: migra antes de abrir a janela
    mdoffice_lib::migrar_pasta_de_dados();
    mdoffice_lib::run()
}
