import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { incomingLeadSamples } from '@/data/activity';

/**
 * Simulates a steady drip of new leads landing. Triggers a toast each time
 * and bumps an external counter via the provided callback.
 */
export function useLiveLeadFeed(onNewLead?: () => void) {
  const idx = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const sample = incomingLeadSamples[idx.current % incomingLeadSamples.length];
      idx.current += 1;
      toast(`New lead from ${sample.source}`, {
        description: `${sample.address}, ${sample.city} — ${sample.equity}% equity`,
        duration: 4000,
      });
      onNewLead?.();
    }, 22000);
    return () => clearInterval(id);
  }, [onNewLead]);
}
