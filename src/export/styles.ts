// CSS extra dos documentos exportados (tema escuro, papel, sumário e modo bilíngue).

export const DARK_VARS = `.markdown-body{--md-fg:#e6e8ee;--md-muted:#9aa3b2;--md-accent:#a5b4fc;--md-border:#2b303b;--md-code-bg:#191d24;--md-code-fg:#e6e8ee;--md-quote-bg:#191d24;--md-table-head:#1b1f27;--md-table-stripe:#171a21;--hl-keyword:#ff7b72;--hl-string:#a5d6ff;--hl-number:#ffa657;--hl-comment:#8b949e;--hl-function:#d2a8ff;--hl-attr:#79c0ff;--hl-builtin:#ffa657;--hl-type:#d2a8ff}
body{background:#0e1014;color:#e6e8ee}.markdown-body mark{background:rgba(250,204,21,.28);color:#fef9c3}`;

export const PAPER_CSS = `body{background:#fff}.markdown-body{font-family:Georgia,"Times New Roman",serif;font-size:15px;line-height:1.6;max-width:760px;padding:24px 8px}
.markdown-body h1,.markdown-body h2,.markdown-body h3{font-family:Georgia,"Times New Roman",serif}`;

export const EXTRA_CSS = `.toc{margin:0 0 2em;padding:14px 18px;border:1px solid var(--md-border);border-radius:10px}
.toc h2{margin:0 0 .4em;font-size:1em;border:0;padding:0}.toc ol{margin:0;padding-left:1.3em}.toc li{margin:.15em 0}.toc .l2{margin-left:1.2em}.toc .l3{margin-left:2.4em}
.bi-head,.bi-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 32px}
.bi-head{padding:0 0 .4em;color:var(--md-muted);font-size:.78em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid var(--md-border)}
.bi-row{border-bottom:1px solid var(--md-border)}.bi-cell{min-width:0}.bi-cell>:first-child{margin-top:.8em}.bi-cell>:last-child{margin-bottom:.8em}
.bi-cell:first-child{padding-right:16px;border-right:1px solid var(--md-border)}.bi-cell+.bi-cell{padding-left:0}
img{max-width:100%}`;
