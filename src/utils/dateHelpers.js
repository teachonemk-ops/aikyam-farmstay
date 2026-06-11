// Date helper utilities for Aikyam Farmstay Booking Calendar

export const getTodayDateString = () => {
  const d = new Date();
  return formatDateToYYYYMMDD(d);
};

export const formatDateToYYYYMMDD = (date) => {
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();

  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (year, month) => {
  // 0 = Sunday, 1 = Monday, etc.
  return new Date(year, month, 1).getDay();
};

// Check if a date is within rolling 90 days from today
export const isWithinRolling90Days = (dateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);

  const limitDate = new Date();
  limitDate.setDate(today.getDate() + 90);
  limitDate.setHours(23, 59, 59, 999);

  return target >= today && target <= limitDate;
};

// Calculate number of nights between check-in and check-out
export const calculateNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Check if a date is a weekend (Friday, Saturday, Sunday)
export const isWeekend = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 5 || day === 6 || day === 0; // 5 = Friday, 6 = Saturday, 0 = Sunday
};

// Check if date range [start1, end1] overlaps with [start2, end2] (Airbnb check-out = check-in overlap allowed)
export const isOverlapping = (start1, end1, start2, end2) => {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);

  // Overlap occurs if start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
};

// Generate calendar grid for a given month and year
export const generateCalendarMonth = (year, month) => {
  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month); // Day of week (0-6)
  
  const days = [];
  
  // Padding from previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthTotalDays = getDaysInMonth(prevYear, prevMonth);
  
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayVal = prevMonthTotalDays - i;
    const dateStr = formatDateToYYYYMMDD(new Date(prevYear, prevMonth, dayVal));
    days.push({
      day: dayVal,
      dateString: dateStr,
      isCurrentMonth: false,
      isPreviousMonth: true,
    });
  }
  
  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    const dateStr = formatDateToYYYYMMDD(new Date(year, month, i));
    days.push({
      day: i,
      dateString: dateStr,
      isCurrentMonth: true,
    });
  }
  
  // Padding for next month to complete the grid (usually 42 cells total)
  const remaining = 42 - days.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  for (let i = 1; i <= remaining; i++) {
    const dateStr = formatDateToYYYYMMDD(new Date(nextYear, nextMonth, i));
    days.push({
      day: i,
      dateString: dateStr,
      isCurrentMonth: false,
      isNextMonth: true,
    });
  }
  
  return days;
};
