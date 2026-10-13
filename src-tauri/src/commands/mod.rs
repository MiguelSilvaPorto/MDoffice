//! Comandos do backend, um módulo por assunto.
//!
//! - `files`    ler/gravar/renomear arquivos e ler imagens
//! - `assets`   pasta `assets/` ao lado do documento
//! - `drafts`   rascunhos do app e pasta padrão de documentos
//! - `projects` estrutura de pastas (contexto para IA) e lista de documentos
//! - `search`   busca dentro dos documentos
//! - `bundle`   pacote ZIP para IA
//! - `trash`    lixeira: documento fora da pasta, guardado por 30 dias antes de sumir
//! - `backup`   cópias datadas dos documentos em disco, proteção antes de sobrescrever
//!              e o índice de espaço

pub mod assets;
pub mod backup;
pub mod bundle;
pub mod drafts;
pub mod files;
pub mod projects;
pub mod search;
pub mod trash;
mod util;

#[cfg(test)]
mod tests;
