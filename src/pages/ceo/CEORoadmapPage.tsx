import { useNavigate } from 'react-router-dom';
import RoadmapView from '@/components/ceo/RoadmapView';
import { CEO_BASE } from '@/config/ceoNav';

export default function CEORoadmapPage() {
  const navigate = useNavigate();

  return (
    <RoadmapView
      onOpenPreview={(screenId) => navigate(`${CEO_BASE}/preview/${screenId}`)}
    />
  );
}
