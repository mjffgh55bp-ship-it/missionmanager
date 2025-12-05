// Simple Hebrew date calculation
const HEBREW_MONTHS = [
  "Nisan", "Iyar", "Sivan", "Tammuz", "Av", "Elul",
  "Tishrei", "Cheshvan", "Kislev", "Tevet", "Shevat", "Adar"
];

const HEBREW_MONTHS_HEB = [
  "ניסן", "אייר", "סיון", "תמוז", "אב", "אלול",
  "תשרי", "חשון", "כסלו", "טבת", "שבט", "אדר"
];

// Convert number to Hebrew numerals
export function toHebrewNumerals(num) {
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  
  if (num <= 0) return "";
  if (num < 10) return ones[num];
  if (num < 20) return "י" + ones[num - 10];
  if (num < 30) return "כ" + ones[num - 20];
  
  const t = Math.floor(num / 10);
  const o = num % 10;
  return tens[t] + ones[o];
}

// Simple approximation of Hebrew date
export function getHebrewDate(gregorianDate) {
  const date = new Date(gregorianDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // This is a simplified approximation
  // For accurate Hebrew dates, a proper library would be needed
  // Using a rough estimate based on typical calendar alignment
  
  const hebrewYear = year + 3760 + (month >= 9 ? 1 : 0);
  
  // Approximate Hebrew month (this is simplified)
  const hebrewMonthIndex = (month + 6) % 12;
  const hebrewDay = ((day + 10) % 30) + 1;
  
  return {
    day: hebrewDay,
    month: HEBREW_MONTHS[hebrewMonthIndex],
    monthHeb: HEBREW_MONTHS_HEB[hebrewMonthIndex],
    year: hebrewYear,
    dayHeb: toHebrewNumerals(hebrewDay)
  };
}

export function formatHebrewDate(gregorianDate) {
  const heb = getHebrewDate(gregorianDate);
  return `${heb.dayHeb} ${heb.monthHeb}`;
}