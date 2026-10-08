//! Comandos do backend, um módulo por assunto.
//!
//! - `files`    ler/gravar/renomear arquivos e ler imagens
//! - `assets`   pasta `assets/` ao lado do documento
//! - `drafts`   rascunhos do app e pasta padrão de documentos
//! - `projects` estrutura de pastas (contexto para IA) e lista de documentos
//! - `search`   busca dentro dos documentos
//! - `bundle`   pacote ZIP para IA

pub mod assets;
pub mod bundle;
pub mod drafts;
pub mod files;
pub mod projects;
pub mod search;
mod util;

#[cfg(test)]
mod tests;
