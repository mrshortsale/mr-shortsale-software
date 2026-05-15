import { Navigate } from 'react-router-dom';
import { CEO_BASE } from '@/config/ceoNav';

/** @deprecated Use /ceo/* routes. Kept for backwards compatibility. */
export default function CEODashboard() {
  return <Navigate to={`${CEO_BASE}/briefing`} replace />;
}
