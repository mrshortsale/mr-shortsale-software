import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Globe, Copy, Check } from 'lucide-react';

interface Script {
  id: string;
  scenario: string;
  en: string;
  es: string;
}

const scripts: Script[] = [
  {
    id: 's1',
    scenario: 'Opening — first contact with listing agent',
    en: `Hi, this is [Rep Name] with Mr. Short Sale. I'm calling because I noticed you have a short sale listing at [Property Address]. We're a short sale processing team that works directly with listing agents — we handle the entire bank negotiation at no cost to you, and you keep your full commission. Do you have 90 seconds for me to explain how it works?`,
    es: `Hola, soy [Rep Name] de Mr. Short Sale. Le llamo porque vi que tiene un short sale en [Property Address]. Somos un equipo que trabaja directamente con agentes — manejamos toda la negociación con el banco sin costo para usted, y usted se queda con su comisión completa. ¿Tiene 90 segundos para que le explique cómo funciona?`,
  },
  {
    id: 's2',
    scenario: 'Value pitch — what we do',
    en: `We've closed over 1,200 short sales in the last 4 years. We deal with every lender — Bank of America, Wells Fargo, Chase, the small servicers, all of them. Average closing: 90 days from approved offer. You list it, you sell it, you collect the commission. We deal with the bank paperwork, the BPO, the negotiation. You never have to call the lender once.`,
    es: `Hemos cerrado más de 1,200 short sales en los últimos 4 años. Trabajamos con todos los bancos — Bank of America, Wells Fargo, Chase, todos. Cierre promedio: 90 días desde la oferta aprobada. Usted lista, usted vende, usted cobra la comisión. Nosotros nos encargamos del papeleo con el banco, el BPO, la negociación. Usted nunca tiene que llamar al banco.`,
  },
  {
    id: 's3',
    scenario: 'Objection — "I already have a processor"',
    en: `Totally understand. Quick question — how long has the file been with them? Because the #1 reason short sales die is the bank reassigning the negotiator and the file going stale. If your current processor is over 60 days in with no approval, we'd be happy to take a look at no obligation. Worst case, you've got a backup.`,
    es: `Lo entiendo perfectamente. Una pregunta rápida — ¿cuánto tiempo lleva el caso con ellos? Porque la razón #1 por la que un short sale muere es el banco reasignando el negociador y el caso se atasca. Si su procesador actual lleva más de 60 días sin aprobación, podemos revisarlo sin compromiso. En el peor caso, tiene un respaldo.`,
  },
  {
    id: 's4',
    scenario: 'Objection — "Why would I switch agents?"',
    en: `You're not switching agents — you stay the listing agent and you keep your full commission. We only handle the short sale processing piece. Think of us as your back office for bank negotiations. Your seller benefits because the file moves faster. Your buyer benefits because they get an answer in weeks, not months.`,
    es: `Usted no cambia de agente — usted sigue siendo el agente listador y se queda con su comisión completa. Nosotros solo manejamos la parte del procesamiento del short sale. Piense en nosotros como su oficina de respaldo para negociaciones con el banco. Su vendedor se beneficia porque el caso avanza más rápido. Su comprador se beneficia porque obtiene una respuesta en semanas, no meses.`,
  },
  {
    id: 's5',
    scenario: 'Close — partnership next steps',
    en: `Great. What I'll do is send you our processing agreement — it's one page, no fee to you. Once you sign, we need the listing agreement, the seller's hardship letter if you have one, and the most recent mortgage statement. We can have the file open with the lender within 48 hours. Sound good?`,
    es: `Perfecto. Le voy a enviar nuestro acuerdo de procesamiento — es una página, sin costo para usted. Una vez firmado, necesitamos el acuerdo de listado, la carta de hardship del vendedor si la tiene, y el estado de cuenta más reciente del préstamo. Podemos tener el caso abierto con el banco en 48 horas. ¿Le parece bien?`,
  },
];

export default function RealtorScripts() {
  const [lang, setLang] = useState<'EN' | 'ES'>('EN');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { t } = useTranslation();

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="metric-card flex items-center gap-3">
        <MessageSquare className="text-secondary" size={20} />
        <div className="flex-1">
          <h3 className="font-bold text-foreground">{t('realtorScripts.libraryTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('realtorScripts.librarySubtitle')}</p>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          <button onClick={() => setLang('EN')} className={`px-3 py-1.5 text-xs font-bold rounded ${lang === 'EN' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>EN</button>
          <button onClick={() => setLang('ES')} className={`px-3 py-1.5 text-xs font-bold rounded ${lang === 'ES' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>ES</button>
        </div>
      </div>

      <div className="space-y-3">
        {scripts.map(s => {
          const text = lang === 'EN' ? s.en : s.es;
          return (
            <div key={s.id} className="metric-card">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-secondary" />
                  <h4 className="font-bold text-foreground text-sm">{s.scenario}</h4>
                </div>
                <button onClick={() => copy(s.id, text)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {copiedId === s.id ? <><Check size={12} /> {t('realtorScripts.copied')}</> : <><Copy size={12} /> {t('realtorScripts.copy')}</>}
                </button>
              </div>
              <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 leading-relaxed whitespace-pre-line">{text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
