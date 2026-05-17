export type AgendaServiceOption = {
  id: string;
  label: string;
  price: number;
};

export const agendaServices: AgendaServiceOption[] = [
  { id: "lavado", label: "Lavado", price: 750 },
  { id: "secado", label: "Secado", price: 500 },
  { id: "rolos", label: "Rolos", price: 1200 },
  { id: "peinados", label: "Peinados", price: 900 },
];

export function getAgendaServiceLabel(serviceId: string) {
  return agendaServices.find((service) => service.id === serviceId)?.label ?? serviceId;
}

export function calculateServicesTotal(selectedIds: string[]) {
  return selectedIds.reduce((acc, serviceId) => {
    const service = agendaServices.find((entry) => entry.id === serviceId);
    return acc + (service?.price ?? 0);
  }, 0);
}
