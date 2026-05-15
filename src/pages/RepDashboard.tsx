import { Navigate } from 'react-router-dom';
import { REP_BASE } from '@/config/repNav';

/** @deprecated Use /rep/* routes. Kept for backwards compatibility. */
export default function RepDashboard() {
  return <Navigate to={`${REP_BASE}/queue`} replace />;
}
