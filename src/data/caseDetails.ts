// Enriched details for pipeline cases — milestones, docs, negotiator, activity
export interface Milestone {
  label: string;
  date: string | null;
  done: boolean;
}

export interface DocItem {
  label: string;
  done: boolean;
}

export interface ActivityEntry {
  date: string;
  author: string;
  text: string;
}

export interface CaseDetails {
  bank_negotiator: string;
  negotiator_phone: string;
  negotiator_email: string;
  last_bank_contact: string;
  days_in_stage: number;
  milestones: Milestone[];
  documents: DocItem[];
  activity_log: ActivityEntry[];
}

const baseDocs = (filled: number): DocItem[] => {
  const all = [
    { label: 'Hardship Letter', done: false },
    { label: 'Last 2 Pay Stubs', done: false },
    { label: 'Last 2 Bank Statements', done: false },
    { label: 'Tax Returns (2 years)', done: false },
    { label: 'Listing Agreement', done: false },
    { label: 'Authorization Form', done: false },
  ];
  return all.map((d, i) => ({ ...d, done: i < filled }));
};

const baseMilestones = (stage: string): Milestone[] => {
  const all = [
    { label: 'Lead qualified', date: 'Mar 12, 2026', done: true },
    { label: 'Hardship docs collected', date: null, done: false },
    { label: 'BPO ordered', date: null, done: false },
    { label: 'Bank package submitted', date: null, done: false },
    { label: 'Negotiator assigned', date: null, done: false },
    { label: 'BPO completed', date: null, done: false },
    { label: 'Approval received', date: null, done: false },
    { label: 'Closing scheduled', date: null, done: false },
  ];
  if (stage === 'Initial Contact') return all.map((m, i) => ({ ...m, done: i < 1 }));
  if (stage === 'Docs Collected') return all.map((m, i) => ({ ...m, done: i < 3, date: i < 3 ? ['Mar 12', 'Mar 28', 'Apr 2'][i] + ', 2026' : null }));
  if (stage === 'Bank Submitted') return all.map((m, i) => ({ ...m, done: i < 5, date: i < 5 ? ['Mar 12', 'Mar 22', 'Mar 26', 'Mar 28', 'Apr 1'][i] + ', 2026' : null }));
  return all.map((m, i) => ({ ...m, done: i < 6, date: i < 6 ? ['Mar 5', 'Mar 14', 'Mar 18', 'Mar 22', 'Mar 25', 'Apr 4'][i] + ', 2026' : null }));
};

export const caseDetails: Record<string, CaseDetails> = {
  p1: { bank_negotiator: 'Pending assignment', negotiator_phone: '—', negotiator_email: '—', last_bank_contact: 'Not yet', days_in_stage: 2, milestones: baseMilestones('Initial Contact'), documents: baseDocs(1), activity_log: [{ date: 'Apr 9', author: 'Maria', text: 'Initial outreach call — homeowner receptive, sending DocuSign.' }] },
  p2: { bank_negotiator: 'Pending assignment', negotiator_phone: '—', negotiator_email: '—', last_bank_contact: 'Not yet', days_in_stage: 3, milestones: baseMilestones('Initial Contact'), documents: baseDocs(0), activity_log: [{ date: 'Apr 9', author: 'James', text: 'Spanish-speaking homeowner. Callback scheduled for 3pm.' }] },
  p3: { bank_negotiator: 'Pending assignment', negotiator_phone: '—', negotiator_email: '—', last_bank_contact: 'Not yet', days_in_stage: 1, milestones: baseMilestones('Initial Contact'), documents: baseDocs(2), activity_log: [{ date: 'Apr 9', author: 'Maria', text: 'Low equity — strong short sale candidate. Hardship letter received.' }] },
  p4: { bank_negotiator: 'Pending assignment', negotiator_phone: '—', negotiator_email: '—', last_bank_contact: 'Apr 8, 2026', days_in_stage: 1, milestones: baseMilestones('Initial Contact'), documents: baseDocs(2), activity_log: [{ date: 'Apr 9', author: 'Cristina', text: 'URGENT — auction in 28 days. Escalated to my desk personally.' }, { date: 'Apr 8', author: 'Luis', text: 'Connected with homeowner. Sending docs tonight.' }] },
  p5: { bank_negotiator: 'Pending assignment', negotiator_phone: '—', negotiator_email: '—', last_bank_contact: 'Not yet', days_in_stage: 2, milestones: baseMilestones('Initial Contact'), documents: baseDocs(0), activity_log: [{ date: 'Apr 9', author: 'James', text: 'Initial outreach pending — leaving voicemail today.' }] },
  p6: { bank_negotiator: 'Sandra Williams', negotiator_phone: '(800) 555-2244', negotiator_email: 's.williams@chase.com', last_bank_contact: 'Apr 6, 2026', days_in_stage: 4, milestones: baseMilestones('Docs Collected'), documents: baseDocs(5), activity_log: [{ date: 'Apr 7', author: 'Maria', text: 'All docs received except listing agreement. Following up with realtor.' }, { date: 'Apr 5', author: 'AI', text: 'Auto-organized hardship package. Ready for review.' }] },
  p7: { bank_negotiator: 'Mark Reynolds', negotiator_phone: '(800) 555-3198', negotiator_email: 'm.reynolds@wellsfargo.com', last_bank_contact: 'Apr 4, 2026', days_in_stage: 6, milestones: baseMilestones('Docs Collected'), documents: baseDocs(4), activity_log: [{ date: 'Apr 6', author: 'Luis', text: 'Missing W-2 — emailed homeowner reminder.' }, { date: 'Apr 3', author: 'Luis', text: 'Hardship letter and bank statements received.' }] },
  p8: { bank_negotiator: 'David Park', negotiator_phone: '(800) 555-7710', negotiator_email: 'd.park@bofa.com', last_bank_contact: 'Apr 2, 2026', days_in_stage: 8, milestones: baseMilestones('Docs Collected'), documents: baseDocs(6), activity_log: [{ date: 'Apr 1', author: 'James', text: 'Complete package assembled. Ready for bank submission tomorrow.' }] },
  p9: { bank_negotiator: 'Linda Carter', negotiator_phone: '(800) 555-1188', negotiator_email: 'l.carter@nationstar.com', last_bank_contact: 'Apr 6, 2026', days_in_stage: 12, milestones: baseMilestones('Bank Submitted'), documents: baseDocs(6), activity_log: [{ date: 'Apr 6', author: 'Maria', text: 'Negotiator confirmed receipt. BPO scheduled next week.' }, { date: 'Mar 28', author: 'AI', text: 'Bank package auto-submitted via portal.' }] },
  p10: { bank_negotiator: 'Robert Chen', negotiator_phone: '(800) 555-4477', negotiator_email: 'r.chen@pnc.com', last_bank_contact: 'Apr 3, 2026', days_in_stage: 15, milestones: baseMilestones('Bank Submitted'), documents: baseDocs(6), activity_log: [{ date: 'Apr 3', author: 'Luis', text: 'BPO scheduling delayed by 1 week. Following up.' }] },
  p11: { bank_negotiator: 'Janet Holmes', negotiator_phone: '(800) 555-6622', negotiator_email: 'j.holmes@jpmorgan.com', last_bank_contact: 'Apr 7, 2026', days_in_stage: 20, milestones: baseMilestones('Bank Submitted'), documents: baseDocs(6), activity_log: [{ date: 'Apr 7', author: 'James', text: 'BPO came in at $875K — negotiating list price down to encourage offers.' }] },
  p12: { bank_negotiator: 'Michael Goldberg', negotiator_phone: '(800) 555-9933', negotiator_email: 'm.goldberg@quicken.com', last_bank_contact: 'Apr 8, 2026', days_in_stage: 25, milestones: baseMilestones('Pending Approval'), documents: baseDocs(6), activity_log: [{ date: 'Apr 8', author: 'Cristina', text: 'Investor sign-off expected this week. Buyer ready to close.' }, { date: 'Apr 4', author: 'Maria', text: 'Final approval letter pending — verbal yes received.' }] },
};

export function getCaseDetails(caseId: string): CaseDetails {
  return caseDetails[caseId] || caseDetails.p1;
}
