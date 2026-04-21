export interface SMSMessage {
  from: 'us' | 'them';
  text: string;
  ts: string;
  status?: 'delivered' | 'read' | 'replied';
}

// SMS threads for leads with sms_sent = true
export const smsThreads: Record<string, SMSMessage[]> = {
  l5: [
    { from: 'us', text: "Hi Robert, this is Maria from Mr. Short Sale. I tried calling earlier about your property at 88 Park Blvd. We help homeowners avoid foreclosure at no cost. Can we talk?", ts: 'Apr 9, 2:14 PM', status: 'read' },
    { from: 'them', text: "Hi, sorry I missed you. Is this really free?", ts: 'Apr 9, 4:32 PM' },
    { from: 'us', text: "Yes — 100% free for you. The bank pays us. We have a 100% approval rate. When's a good time to chat tomorrow?", ts: 'Apr 9, 4:35 PM', status: 'read' },
    { from: 'them', text: "Tomorrow morning around 10 works.", ts: 'Apr 9, 6:01 PM' },
  ],
  l7: [
    { from: 'us', text: "Hi Thomas, Maria here from Mr. Short Sale. Left you a voicemail today regarding 14 Cedar Dr. We can help — no cost. Reply STOP to opt out.", ts: 'Apr 7, 3:22 PM', status: 'delivered' },
  ],
  lj5: [
    { from: 'us', text: "Hola Anthony, soy James de Mr. Short Sale. Tratamos de comunicarnos sobre su propiedad. Podemos ayudarle sin costo. ¿Cuándo es buen momento para hablar?", ts: 'Apr 8, 11:05 AM', status: 'read' },
    { from: 'them', text: "Sí, llámeme mañana después de las 2pm por favor.", ts: 'Apr 8, 7:18 PM' },
  ],
  lj17: [
    { from: 'us', text: "Hi Ryan — James from Mr. Short Sale following up on your home. We help homeowners negotiate with the bank at no cost. Reply YES to schedule a call.", ts: 'Apr 8, 1:45 PM', status: 'delivered' },
  ],
  ll4: [
    { from: 'us', text: "Hi Margaret, Luis here from Mr. Short Sale. We can help with your foreclosure situation — completely free. When can we talk?", ts: 'Apr 8, 10:20 AM', status: 'read' },
    { from: 'them', text: "Please don't contact me again.", ts: 'Apr 8, 11:02 AM' },
    { from: 'us', text: "Understood. We've removed you from our list. Best of luck.", ts: 'Apr 8, 11:04 AM', status: 'delivered' },
  ],
};

export function getSMSThread(leadId: string): SMSMessage[] {
  return smsThreads[leadId] || [
    { from: 'us', text: "Hi, this is your Mr. Short Sale specialist. We tried calling — we can help with your foreclosure at no cost to you. Reply YES to schedule a quick call.", ts: 'Today, 2:14 PM', status: 'delivered' },
  ];
}
