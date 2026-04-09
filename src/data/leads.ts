export type FilingType = 'NOD' | 'Lis Pendens' | 'NTS' | 'REO';
export type CallStatus = 'Not Called' | 'Called' | 'Connected' | 'Callback Scheduled' | 'VM Left' | 'SMS Sent' | 'Not Interested' | 'In Progress';
export type Language = 'EN' | 'ES';

export interface Lead {
  id: string;
  homeowner_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  filing_type: FilingType;
  filing_date: string;
  auction_date: string;
  days_to_auction: number;
  estimated_value: number;
  mortgage_balance: number;
  equity_pct: number;
  data_source_primary: 'Realie' | 'BatchData';
  attom_verified: boolean;
  phone: string;
  email: string;
  language_preference: Language;
  urgency_score: number;
  ai_script_ready: boolean;
  prior_contact: boolean;
  assigned_agent: string;
  call_status: CallStatus;
  last_call_date: string | null;
  last_call_outcome: string | null;
  sms_sent: boolean;
  sms_status: string | null;
  callback_scheduled_at: string | null;
  beds: number;
  baths: number;
  sqft: number;
  year_built: number;
  mortgage_lender: string;
  purchase_price: number;
  purchase_date: string;
}

// Maria's 15 leads
const mariaLeads: Lead[] = [
  { id: 'l1', homeowner_name: 'James Tran', address: '42 Oak St', city: 'White Plains', state: 'NY', zip: '10601', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-04-09', auction_date: '2026-05-20', days_to_auction: 41, estimated_value: 485000, mortgage_balance: 397700, equity_pct: 18, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0101', email: 'jtran@email.com', language_preference: 'EN', urgency_score: 8, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 3, baths: 2, sqft: 1850, year_built: 1992, mortgage_lender: 'Chase', purchase_price: 420000, purchase_date: '2019-06-15' },
  { id: 'l2', homeowner_name: 'Patricia Lopez', address: '5 River Rd', city: 'Bronxville', state: 'NY', zip: '10708', county: 'Westchester', filing_type: 'NTS', filing_date: '2026-04-08', auction_date: '2026-05-07', days_to_auction: 28, estimated_value: 620000, mortgage_balance: 570400, equity_pct: 8, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0102', email: 'plopez@email.com', language_preference: 'EN', urgency_score: 9, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 4, baths: 3, sqft: 2400, year_built: 1985, mortgage_lender: 'Wells Fargo', purchase_price: 550000, purchase_date: '2017-03-22' },
  { id: 'l3', homeowner_name: 'Maria Santos', address: '17 Elm Ave', city: 'Yonkers', state: 'NY', zip: '10701', county: 'Westchester', filing_type: 'Lis Pendens', filing_date: '2026-04-07', auction_date: '2026-06-03', days_to_auction: 55, estimated_value: 390000, mortgage_balance: 304200, equity_pct: 22, data_source_primary: 'BatchData', attom_verified: true, phone: '(914) 555-0103', email: 'msantos@email.com', language_preference: 'ES', urgency_score: 7, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Callback Scheduled', last_call_date: '2026-04-09', last_call_outcome: 'Connected — interested', sms_sent: false, sms_status: null, callback_scheduled_at: '2026-04-09T15:00:00', beds: 3, baths: 1, sqft: 1450, year_built: 1978, mortgage_lender: 'Bank of America', purchase_price: 340000, purchase_date: '2015-09-10' },
  { id: 'l4', homeowner_name: 'Rosa Diaz', address: '44 Maple St', city: 'New Rochelle', state: 'NY', zip: '10801', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-04-06', auction_date: '2026-06-10', days_to_auction: 62, estimated_value: 445000, mortgage_balance: 360450, equity_pct: 19, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0104', email: 'rdiaz@email.com', language_preference: 'ES', urgency_score: 6, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 3, baths: 2, sqft: 1680, year_built: 1995, mortgage_lender: 'CitiMortgage', purchase_price: 380000, purchase_date: '2018-01-20' },
  { id: 'l5', homeowner_name: 'Robert Chen', address: '88 Park Blvd', city: 'Tarrytown', state: 'NY', zip: '10591', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-04-09', auction_date: '2026-06-15', days_to_auction: 67, estimated_value: 520000, mortgage_balance: 462800, equity_pct: 11, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0105', email: 'rchen@email.com', language_preference: 'EN', urgency_score: 7, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'SMS Sent', last_call_date: '2026-04-09', last_call_outcome: 'No Answer', sms_sent: true, sms_status: 'Delivered', callback_scheduled_at: null, beds: 4, baths: 2, sqft: 2100, year_built: 1988, mortgage_lender: 'US Bank', purchase_price: 475000, purchase_date: '2016-07-03' },
  { id: 'l6', homeowner_name: 'Angela Rivera', address: '77 Pine Ave', city: 'New Rochelle', state: 'NY', zip: '10805', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-04-05', auction_date: '2026-07-10', days_to_auction: 92, estimated_value: 510000, mortgage_balance: 387600, equity_pct: 24, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0106', email: 'arivera@email.com', language_preference: 'ES', urgency_score: 5, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Connected', last_call_date: '2026-04-08', last_call_outcome: 'Connected — interested', sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 3, baths: 2, sqft: 1920, year_built: 2001, mortgage_lender: 'Chase', purchase_price: 460000, purchase_date: '2020-02-14' },
  { id: 'l7', homeowner_name: 'Thomas Walsh', address: '14 Cedar Dr', city: 'Scarsdale', state: 'NY', zip: '10583', county: 'Westchester', filing_type: 'Lis Pendens', filing_date: '2026-04-04', auction_date: '2026-07-22', days_to_auction: 104, estimated_value: 780000, mortgage_balance: 663000, equity_pct: 15, data_source_primary: 'BatchData', attom_verified: true, phone: '(914) 555-0107', email: 'twalsh@email.com', language_preference: 'EN', urgency_score: 4, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'VM Left', last_call_date: '2026-04-07', last_call_outcome: 'Voicemail', sms_sent: true, sms_status: 'Delivered', callback_scheduled_at: null, beds: 5, baths: 3, sqft: 3200, year_built: 1975, mortgage_lender: 'Wells Fargo', purchase_price: 700000, purchase_date: '2014-11-05' },
  { id: 'l8', homeowner_name: 'Carlos Mendez', address: '58 Oak Ave', city: 'Ossining', state: 'NY', zip: '10562', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-04-03', auction_date: '2026-08-14', days_to_auction: 126, estimated_value: 355000, mortgage_balance: 323050, equity_pct: 9, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0108', email: 'cmendez@email.com', language_preference: 'ES', urgency_score: 5, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 2, baths: 1, sqft: 1100, year_built: 1982, mortgage_lender: 'Nationstar', purchase_price: 310000, purchase_date: '2016-05-18' },
  { id: 'l9', homeowner_name: 'Linda Foster', address: '92 River St', city: 'Port Chester', state: 'NY', zip: '10573', county: 'Westchester', filing_type: 'NTS', filing_date: '2026-04-02', auction_date: '2026-08-30', days_to_auction: 142, estimated_value: 415000, mortgage_balance: 344450, equity_pct: 17, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0109', email: 'lfoster@email.com', language_preference: 'EN', urgency_score: 3, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 3, baths: 2, sqft: 1750, year_built: 1990, mortgage_lender: 'PNC', purchase_price: 375000, purchase_date: '2018-08-22' },
  { id: 'l10', homeowner_name: 'David Kim', address: '201 Main St', city: 'Mount Vernon', state: 'NY', zip: '10550', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-04-01', auction_date: '2026-06-28', days_to_auction: 79, estimated_value: 365000, mortgage_balance: 295650, equity_pct: 19, data_source_primary: 'BatchData', attom_verified: true, phone: '(914) 555-0110', email: 'dkim@email.com', language_preference: 'EN', urgency_score: 6, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 3, baths: 1, sqft: 1350, year_built: 1970, mortgage_lender: 'Chase', purchase_price: 320000, purchase_date: '2017-12-01' },
  { id: 'l11', homeowner_name: 'Susan Park', address: '303 Elm St', city: 'Peekskill', state: 'NY', zip: '10566', county: 'Westchester', filing_type: 'Lis Pendens', filing_date: '2026-03-31', auction_date: '2026-08-01', days_to_auction: 113, estimated_value: 340000, mortgage_balance: 268600, equity_pct: 21, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0111', email: 'spark@email.com', language_preference: 'EN', urgency_score: 4, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 3, baths: 2, sqft: 1500, year_built: 1985, mortgage_lender: 'Bank of America', purchase_price: 295000, purchase_date: '2015-04-10' },
  { id: 'l12', homeowner_name: "Kevin O'Brien", address: '445 Main Rd', city: 'Rye', state: 'NY', zip: '10580', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-03-30', auction_date: '2026-09-12', days_to_auction: 164, estimated_value: 890000, mortgage_balance: 685300, equity_pct: 23, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0112', email: 'kobrien@email.com', language_preference: 'EN', urgency_score: 3, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 5, baths: 4, sqft: 3800, year_built: 1998, mortgage_lender: 'JPMorgan', purchase_price: 820000, purchase_date: '2013-09-30' },
  { id: 'l13', homeowner_name: 'Diana Huang', address: '11 Valley Rd', city: 'Harrison', state: 'NY', zip: '10528', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-03-29', auction_date: '2026-09-28', days_to_auction: 170, estimated_value: 560000, mortgage_balance: 481600, equity_pct: 14, data_source_primary: 'BatchData', attom_verified: true, phone: '(914) 555-0113', email: 'dhuang@email.com', language_preference: 'EN', urgency_score: 3, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 4, baths: 3, sqft: 2200, year_built: 2005, mortgage_lender: 'Quicken Loans', purchase_price: 510000, purchase_date: '2019-01-15' },
  { id: 'l14', homeowner_name: 'Gloria Flores', address: '22 Church St', city: 'Peekskill', state: 'NY', zip: '10566', county: 'Westchester', filing_type: 'Lis Pendens', filing_date: '2026-03-28', auction_date: '2026-08-05', days_to_auction: 119, estimated_value: 310000, mortgage_balance: 248000, equity_pct: 20, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0114', email: 'gflores@email.com', language_preference: 'ES', urgency_score: 4, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 2, baths: 1, sqft: 1050, year_built: 1972, mortgage_lender: 'CitiMortgage', purchase_price: 270000, purchase_date: '2016-11-20' },
  { id: 'l15', homeowner_name: 'Michael Torres', address: '67 Broad St', city: 'Ossining', state: 'NY', zip: '10562', county: 'Westchester', filing_type: 'NOD', filing_date: '2026-03-27', auction_date: '2026-08-18', days_to_auction: 132, estimated_value: 380000, mortgage_balance: 334400, equity_pct: 12, data_source_primary: 'Realie', attom_verified: true, phone: '(914) 555-0115', email: 'mtorres@email.com', language_preference: 'ES', urgency_score: 4, ai_script_ready: true, prior_contact: false, assigned_agent: 'u2', call_status: 'Not Called', last_call_date: null, last_call_outcome: null, sms_sent: false, sms_status: null, callback_scheduled_at: null, beds: 3, baths: 2, sqft: 1600, year_built: 1988, mortgage_lender: 'Wells Fargo', purchase_price: 340000, purchase_date: '2017-06-08' },
];

// James's 18 leads
const jamesLeads: Lead[] = Array.from({ length: 18 }, (_, i) => {
  const names = ['William Chen', 'Sarah Johnson', 'Mohammed Ali', 'Jennifer White', 'Anthony Brown', 'Lisa Garcia', 'Christopher Lee', 'Amanda Wilson', 'Daniel Martinez', 'Michelle Davis', 'Steven Anderson', 'Kimberly Thomas', 'Brian Jackson', 'Laura Harris', 'Jason Clark', 'Nicole Lewis', 'Ryan Robinson', 'Stephanie Walker'];
  const cities = ['White Plains', 'Yonkers', 'Mount Vernon', 'New Rochelle', 'Tarrytown', 'Scarsdale', 'Peekskill', 'Ossining', 'Port Chester', 'Rye', 'Harrison', 'Bronxville', 'Eastchester', 'Pelham', 'Mamaroneck', 'Larchmont', 'Croton-on-Hudson', 'Dobbs Ferry'];
  const streets = ['Maple Dr', 'Washington Ave', 'Lincoln Blvd', 'Park Pl', 'Forest Ave', 'Highland Rd', 'Prospect St', 'School St', 'Church Ave', 'Spring St', 'Union Ave', 'Center St', 'Mill Rd', 'Lake Ave', 'Summit Dr', 'Orchard Ln', 'Valley Rd', 'Brook St'];
  const filings: FilingType[] = ['NOD', 'Lis Pendens', 'NTS', 'NOD'];
  const statuses: CallStatus[] = ['Not Called', 'Called', 'Connected', 'Not Called', 'SMS Sent', 'VM Left', 'Not Called', 'Callback Scheduled', 'Not Called', 'Not Called', 'Connected', 'Not Called', 'Not Called', 'Called', 'Not Called', 'Not Called', 'SMS Sent', 'Not Called'];
  const equities = [15, 22, 8, 19, 24, 11, 17, 20, 14, 23, 9, 18, 21, 16, 12, 25, 13, 7];
  const daysToAuction = [35, 48, 72, 90, 55, 110, 63, 88, 145, 38, 120, 95, 78, 130, 160, 42, 105, 68];
  const lang: Language[] = ['EN', 'EN', 'EN', 'EN', 'ES', 'EN', 'EN', 'EN', 'ES', 'EN', 'EN', 'EN', 'EN', 'EN', 'EN', 'ES', 'EN', 'EN'];
  return {
    id: `lj${i + 1}`,
    homeowner_name: names[i],
    address: `${100 + i * 7} ${streets[i]}`,
    city: cities[i],
    state: 'NY',
    zip: `105${String(i + 50).padStart(2, '0')}`,
    county: 'Westchester',
    filing_type: filings[i % 4],
    filing_date: `2026-04-${String(9 - (i % 10)).padStart(2, '0')}`,
    auction_date: `2026-${String(5 + Math.floor(daysToAuction[i] / 30)).padStart(2, '0')}-${String(1 + (daysToAuction[i] % 28)).padStart(2, '0')}`,
    days_to_auction: daysToAuction[i],
    estimated_value: 300000 + i * 25000,
    mortgage_balance: Math.round((300000 + i * 25000) * (1 - equities[i] / 100)),
    equity_pct: equities[i],
    data_source_primary: i % 3 === 0 ? 'BatchData' : 'Realie',
    attom_verified: true,
    phone: `(914) 555-0${200 + i}`,
    email: `${names[i].toLowerCase().replace(' ', '.')}@email.com`,
    language_preference: lang[i],
    urgency_score: Math.min(10, Math.max(1, 10 - Math.floor(daysToAuction[i] / 20))),
    ai_script_ready: true,
    prior_contact: i % 5 === 0,
    assigned_agent: 'u3',
    call_status: statuses[i],
    last_call_date: statuses[i] !== 'Not Called' ? '2026-04-08' : null,
    last_call_outcome: statuses[i] === 'Connected' ? 'Connected — interested' : statuses[i] !== 'Not Called' ? 'Follow up needed' : null,
    sms_sent: statuses[i] === 'SMS Sent',
    sms_status: statuses[i] === 'SMS Sent' ? 'Delivered' : null,
    callback_scheduled_at: statuses[i] === 'Callback Scheduled' ? '2026-04-10T14:00:00' : null,
    beds: 2 + (i % 4),
    baths: 1 + (i % 3),
    sqft: 1200 + i * 100,
    year_built: 1970 + (i * 3),
    mortgage_lender: ['Chase', 'Wells Fargo', 'Bank of America', 'CitiMortgage'][i % 4],
    purchase_price: 280000 + i * 20000,
    purchase_date: `${2014 + (i % 6)}-${String(1 + (i % 12)).padStart(2, '0')}-15`,
  } as Lead;
});

// Luis's 17 leads
const luisLeads: Lead[] = Array.from({ length: 17 }, (_, i) => {
  const names = ['Fernando Reyes', 'Catherine Moore', 'Eduardo Silva', 'Margaret Taylor', 'Ricardo Vargas', 'Dorothy Hill', 'Alejandro Cruz', 'Betty Young', 'Juan Morales', 'Sandra King', 'Pedro Castillo', 'Deborah Wright', 'Ramon Gutierrez', 'Sharon Green', 'Hector Ramirez', 'Karen Adams', 'Victor Herrera'];
  const cities = ['Yonkers', 'Mount Vernon', 'New Rochelle', 'White Plains', 'Port Chester', 'Peekskill', 'Ossining', 'Tarrytown', 'Rye', 'Harrison', 'Scarsdale', 'Bronxville', 'Eastchester', 'Pelham', 'Mamaroneck', 'Dobbs Ferry', 'Croton-on-Hudson'];
  const streets = ['Oak Ln', 'Elm Ct', 'Pine Rd', 'Birch Ave', 'Cedar Pl', 'Walnut St', 'Ash Dr', 'Willow Way', 'Poplar Rd', 'Chestnut Ave', 'Sycamore Blvd', 'Holly Dr', 'Beech St', 'Magnolia Ave', 'Juniper Ct', 'Cypress Rd', 'Hemlock Dr'];
  const filings: FilingType[] = ['NOD', 'Lis Pendens', 'NTS', 'NOD'];
  const statuses: CallStatus[] = ['Not Called', 'Connected', 'Not Called', 'SMS Sent', 'Not Called', 'VM Left', 'Not Called', 'Called', 'Not Called', 'Not Called', 'Callback Scheduled', 'Not Called', 'Connected', 'Not Called', 'Not Called', 'Called', 'Not Called'];
  const equities = [20, 13, 24, 10, 18, 22, 7, 16, 25, 11, 19, 14, 23, 8, 21, 15, 17];
  const daysToAuction = [52, 78, 33, 98, 140, 65, 45, 112, 87, 155, 70, 125, 40, 168, 58, 100, 82];
  const lang: Language[] = ['ES', 'EN', 'ES', 'EN', 'ES', 'EN', 'ES', 'EN', 'ES', 'EN', 'ES', 'EN', 'ES', 'EN', 'ES', 'EN', 'ES'];
  return {
    id: `ll${i + 1}`,
    homeowner_name: names[i],
    address: `${200 + i * 11} ${streets[i]}`,
    city: cities[i],
    state: 'NY',
    zip: `105${String(i + 60).padStart(2, '0')}`,
    county: 'Westchester',
    filing_type: filings[i % 4],
    filing_date: `2026-04-${String(9 - (i % 10)).padStart(2, '0')}`,
    auction_date: `2026-${String(5 + Math.floor(daysToAuction[i] / 30)).padStart(2, '0')}-${String(1 + (daysToAuction[i] % 28)).padStart(2, '0')}`,
    days_to_auction: daysToAuction[i],
    estimated_value: 280000 + i * 20000,
    mortgage_balance: Math.round((280000 + i * 20000) * (1 - equities[i] / 100)),
    equity_pct: equities[i],
    data_source_primary: i % 2 === 0 ? 'Realie' : 'BatchData',
    attom_verified: true,
    phone: `(914) 555-0${300 + i}`,
    email: `${names[i].toLowerCase().replace(' ', '.')}@email.com`,
    language_preference: lang[i],
    urgency_score: Math.min(10, Math.max(1, 10 - Math.floor(daysToAuction[i] / 20))),
    ai_script_ready: true,
    prior_contact: i % 4 === 0,
    assigned_agent: 'u4',
    call_status: statuses[i],
    last_call_date: statuses[i] !== 'Not Called' ? '2026-04-08' : null,
    last_call_outcome: statuses[i] === 'Connected' ? 'Connected — qualified' : statuses[i] !== 'Not Called' ? 'Follow up needed' : null,
    sms_sent: statuses[i] === 'SMS Sent',
    sms_status: statuses[i] === 'SMS Sent' ? 'Delivered' : null,
    callback_scheduled_at: statuses[i] === 'Callback Scheduled' ? '2026-04-11T10:00:00' : null,
    beds: 2 + (i % 4),
    baths: 1 + (i % 3),
    sqft: 1100 + i * 90,
    year_built: 1968 + (i * 3),
    mortgage_lender: ['Nationstar', 'Chase', 'Wells Fargo', 'US Bank'][i % 4],
    purchase_price: 260000 + i * 18000,
    purchase_date: `${2013 + (i % 7)}-${String(1 + (i % 12)).padStart(2, '0')}-20`,
  } as Lead;
});

export const allLeads: Lead[] = [...mariaLeads, ...jamesLeads, ...luisLeads];

export function getLeadsForAgent(agentId: string): Lead[] {
  return allLeads.filter(l => l.assigned_agent === agentId).sort((a, b) => b.urgency_score - a.urgency_score);
}

export function getAICallScript(lead: Lead): string {
  return `AI-Generated Call Script — ${lead.homeowner_name}

OPENING: "Hi ${lead.homeowner_name.split(' ')[0]}, my name is [Agent Name], calling from Mr. Short Sale. I'm reaching out because I understand you may be going through some challenges with your ${lead.address} property. I want you to know there are options available to you — and our service is completely free."

KEY POINTS:
  • Our service costs you nothing — we're paid by the bank
  • We have a 100% approval rate — zero denials
  • You have ${lead.days_to_auction} days before the auction — there is still time to act
  • We handle all paperwork and bank negotiations on your behalf

OBJECTION: 'I don't think I qualify'
  → 'With ${lead.equity_pct}% equity and ${lead.filing_type === 'NOD' ? 'an NOD' : 'a ' + lead.filing_type} filed recently, you're actually a strong candidate. Let me take 5 minutes to walk you through what we can do.'

OBJECTION: 'I need to think about it'
  → 'Absolutely — but I want to make sure you have all the facts first. The auction is set for ${lead.auction_date}. Can I call you tomorrow at the same time?'

CLOSE: Book a 15-minute consultation with Cristina or send DocuSign authorization form.`;
}
