import { useMemo, useState } from "react";
import { AppointmentModal } from "../components/AppointmentModal";
import { getAgendaServiceLabel } from "../config/agendaServices";
import { useAppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import type { Appointment } from "../types/domain";
import { currency } from "../utils/format";
import {
  formatAgendaDateLabel,
  getAppointmentsForDate,
  sortAppointments,
  toLocalDateKey,
} from "../utils/agendaSlots";

export function AgendaPage() {
  const { appointments, setAppointments, setNotice } = useAppContext();
  const { isAdmin } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey());
  const [filterText, setFilterText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const dayAppointments = useMemo(
    () => sortAppointments(getAppointmentsForDate(appointments, selectedDate)),
    [appointments, selectedDate],
  );

  const visibleAppointments = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return dayAppointments;

    return dayAppointments.filter((appointment) => {
      const servicesText = appointment.servicios.map((id) => getAgendaServiceLabel(id)).join(" ");
      return `${appointment.cliente} ${appointment.hora} ${servicesText}`.toLowerCase().includes(query);
    });
  }, [dayAppointments, filterText]);

  const dayTotal = useMemo(
    () => dayAppointments.reduce((acc, appointment) => acc + appointment.total, 0),
    [dayAppointments],
  );

  const bookedSlots = dayAppointments.length;

  function openCreateModal() {
    setEditingAppointment(null);
    setModalOpen(true);
  }

  function openEditModal(appointment: Appointment) {
    setEditingAppointment(appointment);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingAppointment(null);
  }

  function saveAppointment(data: Omit<Appointment, "id"> & { id?: string }) {
    if (data.id) {
      setAppointments((prev) => prev.map((appointment) => (
        appointment.id === data.id
          ? {
              id: data.id,
              date: data.date,
              hora: data.hora,
              cliente: data.cliente,
              servicios: data.servicios,
              total: data.total,
            }
          : appointment
      )));
      setNotice(`Cita de ${data.cliente} actualizada para las ${data.hora}.`);
    } else {
      const newAppointment: Appointment = {
        id: `apt-${Date.now()}`,
        date: data.date,
        hora: data.hora,
        cliente: data.cliente,
        servicios: data.servicios,
        total: data.total,
      };
      setAppointments((prev) => [...prev, newAppointment]);
      setNotice(`Cita agendada: ${data.cliente} a las ${data.hora} por ${currency(data.total)}.`);
    }

    closeModal();
  }

  function deleteAppointment(appointment: Appointment) {
    const confirmed = window.confirm(`Eliminar la cita de ${appointment.cliente} a las ${appointment.hora}?`);
    if (!confirmed) return;

    setAppointments((prev) => prev.filter((entry) => entry.id !== appointment.id));
    setNotice(`Cita de ${appointment.cliente} eliminada.`);
  }

  function clearDayAgenda() {
    if (!isAdmin) {
      setNotice("Solo administradores pueden limpiar la agenda del dia.");
      return;
    }

    const confirmed = window.confirm(`Eliminar todas las citas del ${formatAgendaDateLabel(selectedDate)}?`);
    if (!confirmed) return;

    setAppointments((prev) => prev.filter((appointment) => appointment.date !== selectedDate));
    setNotice("Citas del dia eliminadas.");
  }

  return (
    <section className="agenda-screen">
      <div className="row">
        <div>
          <h1>Agenda</h1>
          <p className="muted">Agenda citas cada 30 minutos sin choques de horario.</p>
        </div>
        <div className="actions">
          <button type="button" onClick={openCreateModal}>Agendar cita</button>
          {isAdmin && (
            <button type="button" className="ghost" onClick={clearDayAgenda}>Limpiar dia</button>
          )}
        </div>
      </div>

      <div className="agenda-kpis">
        <article className="card">
          <span className="muted">Fecha</span>
          <strong>{formatAgendaDateLabel(selectedDate)}</strong>
        </article>
        <article className="card">
          <span className="muted">Citas del dia</span>
          <strong>{bookedSlots}</strong>
        </article>
        <article className="card">
          <span className="muted">Total del dia</span>
          <strong>{currency(dayTotal)}</strong>
        </article>
      </div>

      <div className="card agenda-toolbar">
        <label>
          Dia
          <input
            className="agenda-input"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <label>
          Buscar
          <input
            className="agenda-input"
            placeholder="Cliente, hora o servicio..."
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
          />
        </label>
      </div>

      <div className="card agenda-list">
        {visibleAppointments.length === 0 && (
          <p className="muted">No hay citas para este dia. Pulsa Agendar cita para reservar un turno.</p>
        )}

        {visibleAppointments.map((appointment) => (
          <article className="agenda-item" key={appointment.id}>
            <div className="agenda-item-main">
              <div>
                <strong>{appointment.hora}</strong>
                <p className="agenda-client-name">{appointment.cliente}</p>
              </div>
              <div className="agenda-item-services">
                {appointment.servicios.map((serviceId) => (
                  <span className="badge" key={serviceId}>{getAgendaServiceLabel(serviceId)}</span>
                ))}
              </div>
            </div>
            <div className="agenda-item-side">
              <strong>{currency(appointment.total)}</strong>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => openEditModal(appointment)}>Editar</button>
                <button type="button" className="ghost danger-text" onClick={() => deleteAppointment(appointment)}>Eliminar</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {modalOpen && (
        <AppointmentModal
          date={selectedDate}
          appointments={appointments}
          editing={editingAppointment}
          onConfirm={saveAppointment}
          onClose={closeModal}
        />
      )}
    </section>
  );
}
