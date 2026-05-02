import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="card">
      <h1>Página no encontrada</h1>
      <p className="muted">La ruta solicitada no existe en el sistema.</p>
      <Link className="link" to="/">Volver al inicio</Link>
    </section>
  );
}
