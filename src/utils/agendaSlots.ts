import type { Appointment } from "../types/domain";

export const AGENDA_SLOT_MINUTES = 30;
export const AGENDA_DAY_START = "08:00";
export const AGENDA_DAY_END = "20:00";

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getDailyTimeSlots() {
  const start = parseTimeToMinutes(AGENDA_DAY_START);
  const end = parseTimeToMinutes(AGENDA_DAY_END);
  if (start === null || end === null) return [];

  const slots: string[] = [];
  for (let minutes = start; minutes <= end; minutes += AGENDA_SLOT_MINUTES) {
    slots.push(formatMinutesToTime(minutes));
  }
  return slots;
}

export function getAppointmentsForDate(appointments: Appointment[], date: string) {
  return appointments.filter((appointment) => appointment.date === date);
}

export function isTimeSlotTaken(
  appointments: Appointment[],
  date: string,
  hora: string,
  excludeId?: string,
) {
  return appointments.some(
    (appointment) => appointment.date === date
      && appointment.hora === hora
      && appointment.id !== excludeId,
  );
}

export function findAppointmentConflict(
  appointments: Appointment[],
  date: string,
  hora: string,
  excludeId?: string,
) {
  const conflict = appointments.find(
    (appointment) => appointment.date === date
      && appointment.hora === hora
      && appointment.id !== excludeId,
  );

  if (!conflict) return null;

  return `La hora ${hora} ya esta reservada para ${conflict.cliente}. El siguiente turno disponible es 30 minutos despues.`;
}

export function sortAppointments(appointments: Appointment[]) {
  return [...appointments].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.hora.localeCompare(b.hora);
  });
}

export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatAgendaDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "full" }).format(new Date(`${dateKey}T12:00:00`));
}
