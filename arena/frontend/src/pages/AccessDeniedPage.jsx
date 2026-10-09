import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../nav';

export default function AccessDeniedPage() {
  const { user } = useAuth();
  return <EmptyState icon="🔒" title="Access denied"
    body={`You are signed in as ${user?.role || 'a user'}. This page belongs to a different role.`}
    action={<Link className="btn btn--primary" to={homeFor(user?.role)}>Go to my dashboard</Link>} />;
}
