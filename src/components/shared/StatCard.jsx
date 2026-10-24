export default function StatCard({ icon, label, value, note }) {
  return (
    <div className="stat">
      <div className="stat-top"><span>{label}</span><i>{icon}</i></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

