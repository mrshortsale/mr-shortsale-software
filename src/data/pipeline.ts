export type PipelineStage = 'Initial Contact' | 'Docs Collected' | 'Bank Submitted' | 'Pending Approval';

export interface ShortSaleCase {
  id: string;
  homeowner: string;
  address: string;
  stage: PipelineStage;
  auction_date: string;
  equity_pct: number;
  agent: string;
  agent_name: string;
  bank: string;
  attorney: string;
  submission_date: string | null;
  expected_close: string | null;
  notes: string;
}

export const pipelineCases: ShortSaleCase[] = [
  { id: 'p1', homeowner: 'James Tran', address: '42 Oak St, White Plains NY', stage: 'Initial Contact', auction_date: 'May 20, 2026', equity_pct: 18, agent: 'u2', agent_name: 'Maria', bank: 'Chase', attorney: 'Smith & Associates', submission_date: null, expected_close: null, notes: 'First contact made. Homeowner receptive.' },
  { id: 'p2', homeowner: 'Maria Santos', address: '17 Elm Ave, Yonkers NY', stage: 'Initial Contact', auction_date: 'Jun 3, 2026', equity_pct: 22, agent: 'u3', agent_name: 'James', bank: 'Bank of America', attorney: 'Rivera Law Group', submission_date: null, expected_close: null, notes: 'Spanish-speaking. Callback scheduled.' },
  { id: 'p3', homeowner: 'Robert Chen', address: '88 Park Blvd, Tarrytown NY', stage: 'Initial Contact', auction_date: 'Jun 15, 2026', equity_pct: 11, agent: 'u2', agent_name: 'Maria', bank: 'US Bank', attorney: 'Chen Legal', submission_date: null, expected_close: null, notes: 'Low equity — strong candidate.' },
  { id: 'p4', homeowner: 'Patricia Lopez', address: '5 River Rd, Bronxville NY', stage: 'Initial Contact', auction_date: 'May 7, 2026', equity_pct: 8, agent: 'u4', agent_name: 'Luis', bank: 'Wells Fargo', attorney: 'Lopez & Partners', submission_date: null, expected_close: null, notes: 'URGENT — auction in 28 days.' },
  { id: 'p5', homeowner: 'David Kim', address: '201 Main St, Mount Vernon NY', stage: 'Initial Contact', auction_date: 'Jun 28, 2026', equity_pct: 19, agent: 'u3', agent_name: 'James', bank: 'Chase', attorney: 'Kim Legal Services', submission_date: null, expected_close: null, notes: 'Initial outreach pending.' },
  { id: 'p6', homeowner: 'Angela Rivera', address: '77 Pine Ave, New Rochelle NY', stage: 'Docs Collected', auction_date: 'Jul 10, 2026', equity_pct: 24, agent: 'u2', agent_name: 'Maria', bank: 'Chase', attorney: 'Rivera Law Group', submission_date: '2026-04-05', expected_close: '2026-06-15', notes: 'All docs received. Preparing bank package.' },
  { id: 'p7', homeowner: 'Thomas Walsh', address: '14 Cedar Dr, Scarsdale NY', stage: 'Docs Collected', auction_date: 'Jul 22, 2026', equity_pct: 15, agent: 'u4', agent_name: 'Luis', bank: 'Wells Fargo', attorney: 'Walsh & McBride', submission_date: '2026-04-03', expected_close: '2026-06-20', notes: 'Missing W-2 — followed up.' },
  { id: 'p8', homeowner: 'Susan Park', address: '303 Elm St, Peekskill NY', stage: 'Docs Collected', auction_date: 'Aug 1, 2026', equity_pct: 21, agent: 'u3', agent_name: 'James', bank: 'Bank of America', attorney: 'Park Legal', submission_date: '2026-04-01', expected_close: '2026-06-25', notes: 'Complete package. Ready for submission.' },
  { id: 'p9', homeowner: 'Carlos Mendez', address: '58 Oak Ave, Ossining NY', stage: 'Bank Submitted', auction_date: 'Aug 14, 2026', equity_pct: 9, agent: 'u2', agent_name: 'Maria', bank: 'Nationstar', attorney: 'Mendez Law', submission_date: '2026-03-28', expected_close: '2026-06-10', notes: 'Bank acknowledged receipt. Negotiator assigned.' },
  { id: 'p10', homeowner: 'Linda Foster', address: '92 River St, Port Chester NY', stage: 'Bank Submitted', auction_date: 'Aug 30, 2026', equity_pct: 17, agent: 'u4', agent_name: 'Luis', bank: 'PNC', attorney: 'Foster Associates', submission_date: '2026-03-25', expected_close: '2026-06-05', notes: 'Awaiting BPO scheduling.' },
  { id: 'p11', homeowner: "Kevin O'Brien", address: '445 Main Rd, Rye NY', stage: 'Bank Submitted', auction_date: 'Sep 12, 2026', equity_pct: 23, agent: 'u3', agent_name: 'James', bank: 'JPMorgan', attorney: "O'Brien & Sons", submission_date: '2026-03-20', expected_close: '2026-06-01', notes: 'High-value property. BPO completed $875K.' },
  { id: 'p12', homeowner: 'Diana Huang', address: '11 Valley Rd, Harrison NY', stage: 'Pending Approval', auction_date: 'Sep 28, 2026', equity_pct: 14, agent: 'u2', agent_name: 'Maria', bank: 'Quicken Loans', attorney: 'Huang Legal', submission_date: '2026-03-15', expected_close: '2026-05-15', notes: 'Final approval expected this week. Investor sign-off pending.' },
];
