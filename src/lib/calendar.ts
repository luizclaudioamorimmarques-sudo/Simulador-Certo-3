import { format, getDay, isWeekend, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const RIO_TIMEZONE = 'America/Sao_Paulo';

// Feriados Rio de Janeiro 2026 (Exemplos comuns)
const HOLIDAYS_2026 = [
  '2026-01-01', // Ano Novo
  '2026-01-20', // São Sebastião (RJ)
  '2026-02-17', // Carnaval
  '2026-04-03', // Sexta-feira Santa
  '2026-04-21', // Tiradentes
  '2026-04-23', // São Jorge (RJ)
  '2026-05-01', // Dia do Trabalho
  '2026-06-04', // Corpus Christi
  '2026-09-07', // Independência
  '2026-10-12', // Padroeira do Brasil
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-11-20', // Consciência Negra (RJ)
  '2026-12-25', // Natal
];

export function isHoliday(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return HOLIDAYS_2026.includes(dateStr);
}

export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

export function getBusinessDaysInMonth(date: Date): number {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days = eachDayOfInterval({ start, end });
  return days.filter(isBusinessDay).length;
}

export function getElapsedBusinessDays(date: Date): number {
  const start = startOfMonth(date);
  const days = eachDayOfInterval({ start, end: date });
  return days.filter(isBusinessDay).length;
}

export function getRemainingBusinessDays(date: Date): number {
  const end = endOfMonth(date);
  if (date > end) return 0;
  const days = eachDayOfInterval({ start: addDays(date, 1), end });
  return days.filter(isBusinessDay).length;
}

export function getCurrentRioDate(): Date {
  return toZonedTime(new Date(), RIO_TIMEZONE);
}
