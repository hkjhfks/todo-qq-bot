const { readTodosFromDataset } = require('./hfClient');
const { getBeijingToday, addDaysBeijing, formatDateYMD } = require('./dateUtils');

// 只提醒/查询「未完成且有截止日期」的任务
function filterActiveWithDeadline(todos) {
  return (todos || []).filter((t) => {
    if (!t || t.completed) return false;
    const deadline = (t.deadline || '').trim();
    if (!deadline) return false;
    return true;
  });
}

function groupByDeadline(todos) {
  const byDate = new Map();
  for (const t of todos) {
    const deadline = (t.deadline || '').trim();
    if (!deadline) continue;
    if (!byDate.has(deadline)) byDate.set(deadline, []);
    byDate.get(deadline).push(t);
  }
  return byDate;
}

function formatTodoLine(todo) {
  const title = (todo.title || '').trim() || '(无标题)';
  const note = (todo.note || '').trim();
  const deadline = (todo.deadline || '').trim();
  return `${title}:${note}:${deadline}`;
}

function buildListMessage(todos, header) {
  const lines = [];
  if (header) lines.push(header);
  if (!todos.length) {
    lines.push('暂无符合条件的任务。');
    return lines.join('\n');
  }
  for (const t of todos) {
    lines.push(formatTodoLine(t));
  }
  return lines.join('\n');
}

async function queryAllWithDeadline() {
  const todos = await readTodosFromDataset();
  const filtered = filterActiveWithDeadline(todos);
  return buildListMessage(filtered, '【所有有截止日期的未完成任务】');
}

async function queryTodayDue() {
  const todos = await readTodosFromDataset();
  const filtered = filterActiveWithDeadline(todos);
  const today = formatDateYMD(getBeijingToday());
  const todayList = filtered.filter((t) => (t.deadline || '').trim() === today);
  return buildListMessage(todayList, '【今天截止的未完成任务】');
}

async function query3DaysDue() {
  const todos = await readTodosFromDataset();
  const filtered = filterActiveWithDeadline(todos);

  const today = getBeijingToday();
  const d0 = formatDateYMD(today);
  const d1 = formatDateYMD(addDaysBeijing(today, 1));
  const d2 = formatDateYMD(addDaysBeijing(today, 2));
  const targetSet = new Set([d0, d1, d2]);

  const in3Days = filtered.filter((t) => targetSet.has((t.deadline || '').trim()));

  const byDate = groupByDeadline(in3Days);
  const lines = ['【未来三天截止的未完成任务（含今天）】'];
  const dates = Array.from(byDate.keys()).sort();
  if (!dates.length) {
    lines.push('暂无任务。');
    return lines.join('\n');
  }
  for (const d of dates) {
    lines.push(`\n== ${d} ==`);
    for (const t of byDate.get(d)) {
      lines.push(formatTodoLine(t));
    }
  }
  return lines.join('\n');
}

async function queryCheckSummary() {
  const todos = await readTodosFromDataset();
  const filtered = filterActiveWithDeadline(todos);

  const today = getBeijingToday();
  const d0 = formatDateYMD(today);
  const d1 = formatDateYMD(addDaysBeijing(today, 1));
  const d2 = formatDateYMD(addDaysBeijing(today, 2));
  const targetSet = new Set([d0, d1, d2]);

  const in3Days = filtered.filter((t) => targetSet.has((t.deadline || '').trim()));
  const byDate = groupByDeadline(in3Days);

  const summaryLines = ['【CHECK：未来三天的未完成任务】'];
  const dates = Array.from(byDate.keys()).sort();
  if (!dates.length) {
    summaryLines.push('暂无任务。');
  } else {
    for (const d of dates) {
      summaryLines.push(`\n== ${d} ==`);
      for (const t of byDate.get(d)) {
        summaryLines.push(formatTodoLine(t));
      }
    }
  }

  // 今天截止的任务列表（用于额外三条提示）
  const todayList = filtered.filter((t) => (t.deadline || '').trim() === d0);
  const todayMessage = buildListMessage(todayList, '【重要提醒】以下任务今天截止：');

  return {
    summaryMessage: summaryLines.join('\n'),
    todayList,
    todayMessage,
  };
}

module.exports = {
  queryAllWithDeadline,
  queryTodayDue,
  query3DaysDue,
  queryCheckSummary,
};

