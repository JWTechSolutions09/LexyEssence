import { Link } from "react-router-dom";

export function ReportsBackLink() {
  return (
    <Link className="reports-back-link" to="/reportes">
      <span className="material-symbols-outlined">arrow_back</span>
      Volver a Reportes
    </Link>
  );
}
