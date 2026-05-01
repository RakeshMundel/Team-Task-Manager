function Metric({ icon, label, value }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  );
}

export default Metric;
