import LeadQueue from '@/components/rep/LeadQueue';
import SpeedToLeadFeed from '@/components/shared/SpeedToLeadFeed';

export default function RepQueuePage() {
  return (
    <div className="space-y-4">
      <SpeedToLeadFeed compact />
      <LeadQueue />
    </div>
  );
}
