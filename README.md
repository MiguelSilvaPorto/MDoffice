<div align="center">
  <sub>MDOFFICE</sub>

# mdOffice

**Suíte de documentos em português: Markdown, Word, Excel e PowerPoint num app só — com escrita assistida e IA local, sem cobrança extra por IA.**

![status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)
![feito com](https://img.shields.io/badge/feito%20com-TypeScript%20%2B%20Rust%2FTauri-blue)
![plataforma](https://img.shields.io/badge/plataforma-Windows-lightgrey)
![licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green)

[GitHub](https://github.com/MiguelSilvaPorto/mdoffice) ·
[Funcionalidades](docs/funcionalidades.md) ·
[Changelog](CHANGELOG.md) ·
[Estrutura do projeto](docs/estrutura-do-projeto.md)
</div>

---

**mdOffice** é uma suíte de produtividade feita para o português e para rodar no seu computador: você escreve **Markdown**, edita **documentos Word (.docx)**, **planilhas (.xlsx)** e **apresentações (.pptx)** — e a escrita anda junto com um corretor/revisor próprio, tradução automática e uma **IA pequena que roda na sua máquina**. A ideia é simples: assistência de IA faz parte do produto, sem cobrança separada por isso.

## Como começou

O app nasceu como **mdEditor**, um editor de Markdown simples — só escrever e pronto.
Com o tempo a ambição cresceu e tentei construir uma **suíte de documentos** inteira
dentro dele: abas, Word, Excel, PowerPoint, desenho, tradução, revisão. Foi por isso
que o nome virou **mdOffice** — mantém a origem (o Markdown) e ganha por cima os
**editores da suíte**.
Em vários momentos quase desisti.

O que me fez continuar foi a referência do **[DeckCraft](https://getartcraft.com)**,
da **ArtCraft**: ver o que era possível me deu fôlego para seguir. Uso essa referência
só como inspiração de produto — a implementação aqui é própria, feita do zero, sem
copiar código ou conteúdo.

## Módulos

- **MD\*** — o editor de Markdown: realce de sintaxe, pré-visualização ao vivo, desenho
  assistido e em letras, diagramas, imagens, e a escrita assistida (corretor, correção
  automática, sugestões, revisão inteligente, formalização com prévia e tradução PT-BR → inglês). → [detalhes](docs/md.md)
- **Word** — motor de `.docx` de verdade: folha A4/Carta com páginas, cabeçalho, rodapé,
  estilos, tabelas, imagens, zoom; abre e salva `.docx`. → [detalhes](docs/word.md)
- **Excel** — planilha com grade que cresce, fórmulas (com [documentação própria](docs/excel/formulas/README.md)),
  formatação, mesclagem, bordas, abas e zoom; abre `.xlsx`/`.xlsm`. → [detalhes](docs/excel.md)
- **PowerPoint** — apresentações: abre e salva `.pptx` com fidelidade, editor de formas,
  tabelas, gráficos, mídia, transições, modelos, notas e modo apresentação. → [detalhes](docs/powerpoint.md)
- **Geral** — o que vale para o app todo: abas, tela de Início, histórico de versões,
  backup em disco, configurações, busca de comandos e modo foco. → [no changelog](CHANGELOG.md)

## Como rodar

Requisitos: [Rust](https://rustup.rs) (stable) + build tools do Visual Studio (C++),
[Node.js](https://nodejs.org) 20+ e WebView2 (já vem no Windows 10/11).

```bash
npm install     # dependências do frontend
npm run app     # abre o app em modo desenvolvimento (Tauri + Vite)
```

| Comando | O que faz |
| --- | --- |
| `npm run app` | Inicia o app (dev) |
| `npm run app:build` | Compila o app de produção (instalador no Windows) |
| `npm run check` | Checagem de tipos do TypeScript |
| `npm run build` | Build só do frontend (gera `dist/`) |
| `npm run test:log` / `test:backup` / `test:pptx` | Testes do log de alterações, do backup e do `.pptx` |

## Documentação

- [Funcionalidades por módulo](docs/funcionalidades.md)
- [Estrutura do projeto](docs/estrutura-do-projeto.md)
- [Changelog](CHANGELOG.md) — por categoria, o que está na `main` e o que ainda não está
- [Histórico técnico](docs/historico-tecnico.md) — arquivo, linha e o porquê de cada mudança
- [Paridade com o DeckCraft](docs/paridade-deckcraft.md) — checklist do que falta para alcançar a referência
- [Funções do Excel](docs/excel/formulas/README.md)
- [Mapas da UI do DeckCraft](docs/ui-deckcraft-abas.md) · [painéis](docs/ui-deckcraft-paineis.md)

## Licença

MIT — veja [LICENSE](LICENSE). © 2026 Miguel Silva Porto.

O código do projeto é MIT; os componentes de terceiros mantêm as licenças próprias —
o modelo **Gemma** (Termos de Uso do Gemma, aviso em `AVISO-GEMMA.txt`), as fontes
embutidas (OFL) e os dicionários derivados do LibreOffice/TeP.

<div align="center">
  <sub>
    <a href="https://getartcraft.com">DeckCraft on getartcraft.com</a> ·
    <a href="https://getartcraft.com">ArtCraft</a>
  </sub>
</div>
