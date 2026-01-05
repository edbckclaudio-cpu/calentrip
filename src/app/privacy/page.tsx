export const metadata = {
  title: "Política de Privacidade - CalenTrip",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold text-[#2563eb] border-b-2 border-[#2563eb] pb-2">Política de Privacidade</h1>
        <p className="mt-4 text-zinc-800">
          Esta Política de Privacidade descreve como o aplicativo <strong>CalenTrip</strong> (digital.calentrip.android) coleta, usa e protege suas informações.
        </p>

        <h2 className="mt-8 text-2xl font-semibold text-[#1e40af]">1. Coleta de Informações</h2>
        <p className="mt-2 text-zinc-800">Para o funcionamento do CalenTrip, coletamos os seguintes dados:</p>
        <ul className="list-disc pl-6 mt-2 text-zinc-800 space-y-1">
          <li>
            <strong>Informações de Conta:</strong> Nome e endereço de e-mail fornecidos durante o cadastro/login.
          </li>
          <li>
            <strong>Dados de Calendário:</strong> Informações sobre viagens, datas e destinos inseridos pelo usuário para fins de organização.
          </li>
          <li>
            <strong>Dados Técnicos:</strong> Identificadores de dispositivo e logs de erro para melhoria da estabilidade do app.
          </li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold text-[#1e40af]">2. Uso dos Dados</h2>
        <p className="mt-2 text-zinc-800">Os dados são utilizados exclusivamente para:</p>
        <ul className="list-disc pl-6 mt-2 text-zinc-800 space-y-1">
          <li>Sincronizar suas viagens entre diferentes dispositivos.</li>
          <li>Garantir a segurança do seu acesso através de autenticação.</li>
          <li>Melhorar a experiência de uso e corrigir falhas técnicas.</li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold text-[#1e40af]">3. Compartilhamento e Terceiros</h2>
        <p className="mt-2 text-zinc-800">
          Não vendemos ou compartilhamos seus dados pessoais com anunciantes. Utilizamos serviços de infraestrutura confiáveis para processamento:
        </p>
        <ul className="list-disc pl-6 mt-2 text-zinc-800 space-y-1">
          <li>
            <strong>Firebase:</strong> Para armazenamento seguro e autenticação.
          </li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold text-[#1e40af]">4. Seus Direitos (LGPD)</h2>
        <p className="mt-2 text-zinc-800">
          Você tem o direito de acessar, corrigir ou excluir seus dados a qualquer momento. O aplicativo oferece uma opção direta para{" "}
          <strong>Exclusão de Conta</strong> nas configurações de perfil.
        </p>

        <h2 className="mt-8 text-2xl font-semibold text-[#1e40af]">5. Segurança</h2>
        <p className="mt-2 text-zinc-800">Todas as comunicações entre o aplicativo e nossos servidores são criptografadas via protocolo HTTPS/TLS.</p>

        <div className="mt-12 text-sm text-zinc-600 border-t border-zinc-200 pt-4">
          <p>
            <strong>CalenTrip</strong>
            <br />
            Contato: <a className="text-[#2563eb]" href="mailto:calentrip.support@proton.me">calentrip.support@proton.me</a>
            <br />
            Última atualização: 20 de dezembro de 2025
          </p>
        </div>
      </div>
    </div>
  );
}
