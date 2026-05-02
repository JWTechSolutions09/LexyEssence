import { useAppContext } from "../context/AppContext";
import { useMemo, useState } from "react";

export function AgendaPage() {
  const { appointments, setAppointments, setNotice } = useAppContext();
  const [filterText, setFilterText] = useState("");
  const [serviceFilter, setServiceFilter] = useState("Todos");
  const services = useMemo(
    () => ["Todos", ...Array.from(new Set(appointments.map((a) => a.servicio)))],
    [appointments],
  );
  const visibleAppointments = appointments.filter((a) => {
    const serviceMatch = serviceFilter === "Todos" || a.servicio === serviceFilter;
    const textMatch = `${a.cliente} ${a.servicio} ${a.hora}`.toLowerCase().includes(filterText.toLowerCase());
    return serviceMatch && textMatch;
  });

  function addAppointment() {
    setAppointments((prev) => [...prev, { hora: "16:00", cliente: "Cliente Nuevo", servicio: "Mani-Pedi de Seda" }]);
    setNotice("Cita reservada correctamente.");
  }

  function clearAgenda() {
    setAppointments([]);
    setNotice("Agenda limpiada.");
  }

  function viewAppointments() {
    setFilterText("");
    setServiceFilter("Todos");
    setNotice(`Visualizando ${appointments.length} cita(s).`);
  }

  return (
    <section className="agenda-screen">
      <div className="row">
        <div>
          <h1>Agenda</h1>
          <p className="muted">Planificación diaria de citas y servicios.</p>
        </div>
        <div className="actions">
          <button className="ghost" onClick={viewAppointments}>Ver citas</button>
          <button onClick={addAppointment}>Agendar cita</button>
          <button className="ghost" onClick={clearAgenda}>Limpiar agenda</button>
        </div>
      </div>
      <div className="agenda-kpis">
        <article className="card"><span className="muted">Citas totales</span><strong>{appointments.length}</strong></article>
        <article className="card"><span className="muted">Primera cita</span><strong>{appointments[0]?.hora ?? "--:--"}</strong></article>
        <article className="card"><span className="muted">Última cita</span><strong>{appointments.at(-1)?.hora ?? "--:--"}</strong></article>
      </div>
      <div className="card agenda-toolbar">
        <input
          placeholder="Buscar cliente, servicio u hora..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          {services.map((service) => <option key={service} value={service}>{service}</option>)}
        </select>
      </div>
      <div className="card">
        {visibleAppointments.length === 0 && <p className="muted">No hay citas que coincidan con los filtros.</p>}
        {visibleAppointments.map((a, index) => (
          <div className="list-item" key={`${a.hora}-${index}`}>
            <div>
              <strong>{a.hora}</strong>
              <p className="muted">{a.cliente}</p>
            </div>
            <div className="actions">
              <span className="badge">{a.servicio}</span>
              <button className="ghost" onClick={() => setNotice(`Cita de ${a.cliente} actualizada (demo).`)}>Editar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
