## v0.1.1 — Fluxo de voos estabilizado

- Corrigir condição de corrida na transição `/flights/search` → `/flights/book`.
- Adicionar guarda de carregamento e retries (~800ms) na `/flights/book` para restaurar `tripSearch` de `sessionStorage/localStorage`.
- Inicializar `TripProvider` via `useEffect` com setState assíncrono.
- Ajustar a `/flights/search` para não limpar `sessionStorage`/`tripSearch` ao montar.
- Reduzir atraso de navegação para `500ms` mantendo persistência confiável.
- Reativar `SessionProvider` com configuração conservadora.
- Atualizar links agregadores (inclui Skyscanner) na `/flights/book`.
- Remover fallback precoce “Nenhuma viagem salva” e usar “Carregando busca…”.

Commits relacionados: dcc8edf
