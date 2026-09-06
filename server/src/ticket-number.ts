export function generateTicketNumber(
  year: number,
  nextNumber: number
): string {
  return `TKT-${year}-${String(nextNumber).padStart(6, "0")}`;
}