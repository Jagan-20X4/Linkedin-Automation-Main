/** Week 1 = start of local calendar day of `createdAt`; each slot +7 days. Month 1 = same anchor; each slot +1 calendar month (day clamped to month length). */
function startOfLocalDay(iso: string): Date {
  const base = new Date(iso);
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    0,
    0,
    0,
    0,
  );
  return d;
}

/** Same calendar day in a target month when possible; otherwise last day of that month (e.g. Jan 31 → Feb 28). */
function addCalendarMonths(anchor: Date, monthsToAdd: number): Date {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const day = anchor.getDate();
  const target = new Date(y, m + monthsToAdd, 1, 0, 0, 0, 0);
  const lastDayOfMonth = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(day, lastDayOfMonth));
  return target;
}

export function calculateScheduledDates(
  durationType: "weeks" | "months",
  durationValue: number,
  createdAt: string,
): string[] {
  const dates: string[] = [];
  const anchor = startOfLocalDay(createdAt);

  if (durationType === "weeks") {
    for (let i = 0; i < durationValue; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i * 7);
      dates.push(d.toISOString());
    }
  } else {
    for (let i = 0; i < durationValue; i++) {
      dates.push(addCalendarMonths(anchor, i).toISOString());
    }
  }

  return dates;
}
