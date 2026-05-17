import { useEffect, useMemo, useState, type FormEvent } from "react";
import { agendaServices, calculateServicesTotal, getAgendaServiceLabel } from "../config/agendaServices";
import type { Appointment } from "../types/domain";
import { currency } from "../utils/format";
import {
  findAppointmentConflict,
  formatAgendaDateLabel,
  getDailyTimeSlots,
  isTimeSlotTaken,
} from "../utils/agendaSlots";

type AppointmentModalProps = {
  date: string;
  appointments: Appointment[];
  editing?: Appointment | null;
  onConfirm: (appointment: Omit<Appointment, "id"> & { id?: string }) => void;
  onClose: () => void;
};

export function AppointmentModal({
  date,
  appointments,
  editing,
  onConfirm,
  onClose,
}: AppointmentModalProps) {
  const [cliente, setCliente] = useState(editing?.cliente ?? "");
  const [hora, setHora] = useState(editing?.hora ?? "");
  const [selectedServices, setSelectedServices] = useState<string[]>(editing?.servicios ?? []);
  const [totalInput, setTotalInput] = useState(
    editing ? String(editing.total) : "",
  );
  const [error, setError] = useState("");

  const suggestedTotal = useMemo(
    () => calculateServicesTotal(selectedServices),
    [selectedServices],
  );

  const timeSlots = useMemo(() => {
    return getDailyTimeSlots().map((slot) => ({
      value: slot,
      taken: isTimeSlotTaken(appointments, date, slot, editing?.id),
    }));
  }, [appointments, date, editing?.id]);

  useEffect(() => {
    if (editing) return;
    setTotalInput(suggestedTotal > 0 ? String(suggestedTotal) : "");
  }, [editing, suggestedTotal]);

  function toggleService(serviceId: string) {
    setError("");
    setSelectedServices((prev) => (
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    ));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedName = cliente.trim();
    if (!trimmedName) {
      setError("Ingresa el nombre del cliente.");
      return;
    }

    if (!hora) {
      setError("Selecciona la hora de la cita.");
      return;
    }

    if (selectedServices.length === 0) {
      setError("Selecciona al menos un servicio.");
      return;
    }

    const total = Number(totalInput);
    if (!Number.isFinite(total) || total < 0) {
      setError("Ingresa un total valido.");
      return;
    }

    const conflict = findAppointmentConflict(appointments, date, hora, editing?.id);
    if (conflict) {
      setError(conflict);
      return;
    }

    onConfirm({
      id: editing?.id,
      date,
      hora,
      cliente: trimmedName,
      servicios: selectedServices,
      total,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card agenda-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="appointment-modal-title">{editing ? "Editar cita" : "Agendar cita"}</h2>
            <p className="muted">{formatAgendaDateLabel(date)}</p>
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <form className="agenda-form" onSubmit={handleSubmit} data-manual-input>
          <label>
            Nombre del cliente
            <input
              className="agenda-input"
              value={cliente}
              onChange={(event) => {
                setError("");
                setCliente(event.target.value);
              }}
              placeholder="Ej. Maria Perez"
              autoFocus
              required
            />
          </label>

          <label>
            Hora
            <select
              className="agenda-input"
              value={hora}
              onChange={(event) => {
                setError("");
                setHora(event.target.value);
              }}
              required
            >
              <option value="">Seleccionar hora</option>
              {timeSlots.map((slot) => (
                <option key={slot.value} value={slot.value} disabled={slot.taken}>
                  {slot.value}{slot.taken ? " (ocupada)" : ""}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="agenda-services-fieldset">
            <legend>Servicios</legend>
            <div className="agenda-services-grid">
              {agendaServices.map((service) => (
                <label key={service.id} className="agenda-service-option">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                  />
                  <span>
                    <strong>{service.label}</strong>
                    <span className="muted">{currency(service.price)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Total de la cita
            <input
              className="agenda-input"
              type="number"
              min="0"
              step="0.01"
              value={totalInput}
              onChange={(event) => {
                setError("");
                setTotalInput(event.target.value);
              }}
              required
            />
          </label>

          {selectedServices.length > 0 && (
            <p className="muted agenda-services-summary">
              {selectedServices.map((id) => getAgendaServiceLabel(id)).join(", ")}
              {suggestedTotal > 0 && ` · Sugerido ${currency(suggestedTotal)}`}
            </p>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
            <button type="submit">{editing ? "Guardar cambios" : "Confirmar cita"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
