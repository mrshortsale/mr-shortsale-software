import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { SheetLead } from '@/services/sheetsLeads';

interface Props {
  lead: SheetLead;
  compact?: boolean;
}

export default function PushedToMojoCell({ lead, compact = false }: Props) {
  const { t } = useTranslation();

  if (lead.mojoPushedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-accent/15 text-accent">
        <Check size={compact ? 10 : 11} />
        {t('speedTable.pushedToMojo')}
      </span>
    );
  }

  return <span className="text-muted-foreground text-xs">—</span>;
}
