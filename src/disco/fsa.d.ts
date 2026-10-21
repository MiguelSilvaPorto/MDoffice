// O File System Access API (o Chromium): é ele que dá ao app o acesso ao disco do
// navegador — a pessoa escolhe a pasta uma vez e o app ganha o "handle" (o objeto que
// representa a pasta/arquivo e sobrevive ao recarregar a página).
//
// Os TIPOS do handle já estão no lib.dom do TypeScript; o que falta são as FUNÇÕES de
// escolha (só existem no Chromium) e as de permissão. Aqui vão as declarações que faltam.

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  /** O Chromium pergunta a permissão antes de gravar (o Firefox não tem isto). */
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  /** a pasta que contém este item (o Chromium tem; o lib.dom do TS ainda não) */
  readonly parent?: FileSystemDirectoryHandle;
}

interface FileSystemDirectoryHandle {
  /** o que tem dentro da pasta (o lib.dom do TS traz só o `entries`) */
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface DataTransferItem {
  /**
   * O handle do arquivo arrastado (só no Chromium, e só quando o item veio do sistema de
   * arquivos). É o que permite abrir e gravar o documento solto na janela.
   */
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}

interface FilePickerAcceptType {
  description?: string;
  /** o tipo do arquivo (extensão) → os tipos MIME aceitos */
  accept: Record<string, string | string[]>;
}

interface FilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  /** o nome sugerido ao salvar */
  suggestedName?: string;
  /** onde o diálogo começa (uma pasta já escolhida) */
  startIn?: FileSystemHandle | string;
  /** o que a pessoa pode fazer com o que escolher ("read" ou "readwrite") */
  mode?: "read" | "readwrite";
  id?: string;
}

interface Window {
  showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>;
  showDirectoryPicker?(options?: FilePickerOptions): Promise<FileSystemDirectoryHandle>;
}
