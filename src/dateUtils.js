function toBeijingDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  // Date.getTime() 始终是 UTC 时间戳，这里直接加 8 小时，
  // 然后用 UTC 的年月日来表示北京时间的“这一天”。
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return new Date(
    beijing.getUTCFullYear(),
    beijing.getUTCMonth(),
    beijing.getUTCDate()
  );
}

function formatDateYMD(date) {
  const d = toBeijingDate(date);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getBeijingToday() {
  return toBeijingDate(new Date());
}

function addDaysBeijing(date, days) {
  const d = toBeijingDate(date);
  if (!d) return null;
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

module.exports = {
  toBeijingDate,
  formatDateYMD,
  getBeijingToday,
  addDaysBeijing,
};
