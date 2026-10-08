// O HTML da janela do construtor de diagramas.

export function builderHtml(mode: "form" | "code"): string {
  return `    <header class="wm-head">
      <svg class="ic"><use href="#i-flow"/></svg>
      <h2>Diagrama</h2>
      <span class="muted dg-sub">${mode === "code" ? "Editando o código do diagrama" : "Preencha os campos — a pré-visualização aparece aqui embaixo"}</span>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="dg-body">
      <div class="dg-note" hidden>
        <span>Você está escrevendo o <b>código</b> direto — os campos ficam pausados para não sobrescrever nada.</span>
        <span class="dr-spacer"></span>
        <button class="btn" data-resume>Voltar aos campos (regenera o código)</button>
      </div>
      <div class="dg-form">
        <div class="dg-line">
          <label>Tipo
            <select class="dg-kind">
              <option value="flow">Fluxo (passos e setas)</option>
              <option value="sequence">Sequência (troca de mensagens)</option>
              <option value="state">Estados (situações e mudanças)</option>
            </select>
          </label>
          <label class="dg-grow">Título
            <input type="text" class="dg-title" placeholder="Ex.: Fluxo de aprovação de pedido" />
          </label>
        </div>
        <div class="dg-fields"></div>
        <div class="dg-line">
          <button class="btn" data-add>＋ Adicionar linha</button>
          <button class="btn" data-example>Título de exemplo</button>
          <span class="muted dg-enter-hint">Dica: Enter num campo já cria a próxima linha</span>
        </div>
      </div>
      <div class="dg-preview">
        <div class="dg-preview-head">
          <span>Pré-visualização</span>
          <span class="dg-error" hidden></span>
          <span class="dr-spacer"></span>
          <div class="dg-quick" title="Adicione passos e clique neles para continuar o fluxo">
            <button class="tbtn wide" type="button" data-quick="process">＋ Passo</button>
            <button class="tbtn wide" type="button" data-quick="decision">＋ Decisão</button>
            <button class="tbtn wide" type="button" data-quick="end">＋ Fim</button>
          </div>
          <button class="btn icon" data-code-toggle title="Mostrar/ocultar o código"><svg class="ic"><use href="#i-code"/></svg></button>
        </div>
        <div class="mermaid-host dg-canvas"></div>
        <div class="dg-node-bar" hidden>
          <span class="dg-node-name"></span>
          <button class="btn" type="button" data-node="after" title="Cria um passo novo já ligado a este">＋ Passo depois</button>
          <button class="btn" type="button" data-node="rename" title="Editar o texto deste passo">✏ Texto</button>
          <button class="btn" type="button" data-node="remove" title="Apagar este passo">🗑 Apagar</button>
        </div>
        <div class="dg-code-head">
          <span>Código Mermaid — <b>você pode escrever aqui</b></span>
          <span class="dr-spacer"></span>
          <button class="btn" data-copy-code>Copiar</button>
        </div>
        <textarea class="dg-code" spellcheck="false" placeholder="flowchart TD&#10;  A[Início] --> B[Fim]"></textarea>
      </div>
    </div>
    <footer class="wm-foot">
      <span class="muted">Ctrl+Enter insere no documento · Esc fecha</span>
      <span class="dr-spacer"></span>
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" data-insert>Inserir no documento</button>
    </footer>`;
}
