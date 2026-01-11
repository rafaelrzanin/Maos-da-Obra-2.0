
import React from 'react';

/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const surface =
  "bg-white border border-slate-200/90 shadow-card-default ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-card-dark-subtle dark:ring-0";

const card = "rounded-3xl p-6 lg:p-8";
const mutedText = "text-slate-500 dark:text-slate-400";


const HelpFAQ: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans animate-in fade-in">
      <h1 className="text-3xl font-black text-primary dark:text-white mb-6 tracking-tight">Ajuda e Dúvidas</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-2xl mb-8">
        Aqui você encontra um guia rápido para entender como o Mãos da Obra funciona e tirar suas dúvidas mais comuns.
      </p>

      <div className={cx(surface, card, "space-y-8")}>
        <section>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-3 flex items-center gap-3">
            <i className="fa-solid fa-house-chimney-crack text-secondary"></i> O que é uma "Obra" no App?
          </h2>
          <p className="text-base text-slate-700 dark:text-slate-300">
            Uma "Obra" é o seu projeto de construção ou reforma. Cada obra tem seu próprio cronograma, lista de materiais, controle financeiro e ferramentas específicas. Você pode ter quantas obras quiser, cada uma organizada de forma independente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-3 flex items-center gap-3">
            <i className="fa-solid fa-compass-drafting text-secondary"></i> Para que serve cada área principal?
          </h2>
          <div className="space-y-4 text-base text-slate-700 dark:text-slate-300">
            <p>
              <span className="font-bold">Cronograma:</span> Aqui você organiza as etapas do projeto. Pode adicionar, editar, reordenar e marcar como concluídas. É a espinha dorsal da sua obra.
            </p>
            <p>
              <span className="font-bold">Materiais:</span> Lista detalhada de todos os materiais necessários para cada etapa. Você planeja a quantidade e registra o que já comprou, com o custo.
            </p>
            <p>
              <span className="font-bold">Financeiro:</span> Acompanhe todas as despesas da obra. Registre pagamentos, veja o balanço com o orçamento e evite surpresas.
            </p>
            <p>
              <span className="font-bold">Ferramentas:</span> Um conjunto de utilitários como gestão de equipe e fornecedores, galeria de fotos, arquivos, checklists e acesso às funcionalidades de IA.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-3 flex items-center gap-3">
            <i className="fa-solid fa-map-pin text-secondary"></i> Por onde normalmente se começa?
          </h2>
          <p className="text-base text-slate-700 dark:text-slate-300">
            Ao criar uma nova obra, o ideal é usar o Planejador Inteligente AI para gerar um cronograma e uma lista de materiais inicial. Depois, na tela da obra, comece revisando as "Etapas" (Cronograma) para ter uma visão geral e, em seguida, navegue para "Materiais" e "Financeiro" conforme a obra avança.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-3 flex items-center gap-3">
            <i className="fa-solid fa-save text-secondary"></i> O que acontece quando salvo algo?
          </h2>
          <p className="text-base text-slate-700 dark:text-slate-300">
            Tudo o que você salva no Mãos da Obra é automaticamente guardado na nuvem. Você não precisa apertar um botão de "Salvar" extra. As informações ficam seguras e acessíveis de qualquer lugar, a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-3 flex items-center gap-3">
            <i className="fa-solid fa-check-circle text-secondary"></i> Como saber que uma ação deu certo?
          </h2>
          <p className="text-base text-slate-700 dark:text-slate-300">
            Após realizar uma ação importante (como adicionar uma etapa, registrar uma compra ou atualizar um perfil), você geralmente verá uma pequena mensagem de "brinde" (toast notification) na parte superior da tela confirmando o sucesso da operação. Se algo der errado, uma mensagem de erro será exibida.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-primary dark:text-white mb-3 flex items-center gap-3">
            <i className="fa-solid fa-question-circle text-secondary"></i> Dúvidas Frequentes
          </h2>
          <div className="space-y-4 text-base text-slate-700 dark:text-slate-300">
            <p>
              <span className="font-bold">O que é o Zé da Obra AI?</span> É seu assistente virtual de engenharia. Ele pode te ajudar a planejar obras, tirar dúvidas técnicas, dar dicas de economia e segurança, e muito mais, tudo em tempo real.
            </p>
            <p>
              <span className="font-bold">Meu acesso à IA expirou. E agora?</span> O acesso completo à IA é uma funcionalidade premium. Você pode adquirir o Plano Vitalício na seção de "Configurações" para ter acesso ilimitado.
            </p>
            <p>
              <span className="font-bold">Como reordenar as etapas do cronograma?</span> Na aba "Cronograma", você pode arrastar e soltar as etapas (apenas as que ainda não foram iniciadas) para mudar a ordem.
            </p>
            <p>
              <span className="font-bold">Como gerencio os pagamentos das despesas?</span> Na aba "Financeiro", ao clicar em uma despesa, você pode registrar novos pagamentos para ela. O status da despesa (Pendente, Parcial, Concluído, Prejuízo) será atualizado automaticamente.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HelpFAQ;
