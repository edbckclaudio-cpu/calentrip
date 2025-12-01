export default function PrivacyPage() {
  return (
    <div className="container-page py-6 space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--brand)]">Política de Privacidade</h1>
      <p className="text-sm text-zinc-700">Coletamos dados mínimos para funcionamento: localização em primeiro plano para gerar rotas e links de transporte, dados de compras via Google Play e preferências salvas no dispositivo.</p>
      <p className="text-sm text-zinc-700">Não armazenamos senhas. Autenticação ocorre por provedores externos. Dados de viagens e anexos ficam no dispositivo do usuário.</p>
      <p className="text-sm text-zinc-700">Em Android, compras são processadas pelo Google Play. Em caso de dúvidas ou solicitações, utilize a página de Suporte.</p>
    </div>
  );
}
