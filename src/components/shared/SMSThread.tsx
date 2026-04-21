import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Lead } from '@/data/leads';
import { SMSMessage } from '@/data/sms';
import { Check, CheckCheck } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  thread: SMSMessage[];
}

export default function SMSThread({ open, onOpenChange, lead, thread }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="bg-primary text-primary-foreground p-4">
          <DialogTitle className="text-primary-foreground">{lead.homeowner_name}</DialogTitle>
          <p className="text-xs opacity-80">{lead.phone} · {lead.language_preference === 'ES' ? 'Español' : 'English'}</p>
        </DialogHeader>

        <div className="bg-muted/30 p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {thread.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'us' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${msg.from === 'us' ? 'bg-secondary text-secondary-foreground rounded-br-sm' : 'bg-card border rounded-bl-sm'}`}>
                <p className="text-sm">{msg.text}</p>
                <div className={`flex items-center gap-1 mt-1 text-[10px] ${msg.from === 'us' ? 'text-secondary-foreground/70 justify-end' : 'text-muted-foreground'}`}>
                  <span>{msg.ts}</span>
                  {msg.from === 'us' && msg.status && (
                    msg.status === 'read' || msg.status === 'replied'
                      ? <CheckCheck size={11} className="text-accent" />
                      : <Check size={11} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t bg-card flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
          Sent automatically via Twilio · Auto-translated to {lead.language_preference === 'ES' ? 'Spanish' : 'English'}
        </div>
      </DialogContent>
    </Dialog>
  );
}
