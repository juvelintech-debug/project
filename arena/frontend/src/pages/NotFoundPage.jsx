import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon="🧭"
      title="Page not found"
      body="That route does not exist in this application."
      action={<Link className="btn btn--primary" to="/status">Back to system status</Link>}
    />
  );
}
