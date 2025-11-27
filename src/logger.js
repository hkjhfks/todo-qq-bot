const MAX_LINES = 500;

const buffer = [];
const listeners = new Set();

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function pushLine(line) {
  if (typeof line !== 'string') return;
  buffer.push(line);
  if (buffer.length > MAX_LINES) {
    buffer.shift();
  }
  for (const fn of listeners) {
    try {
      fn(line);
    } catch (e) {
      // ignore listener errors
    }
  }
}

function formatLine(level, args) {
  const ts = new Date().toISOString();
  const parts = args.map((arg) => {
    if (typeof arg === 'string') return arg;
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  });
  return `[${ts}] [${level}] ${parts.join(' ')}`;
}

function makeWrapped(level) {
  return (...args) => {
    const line = formatLine(level, args);
    pushLine(line);

    const fn =
      originalConsole[level.toLowerCase()] || originalConsole.log || console.log;
    fn(...args);
  };
}

function patchConsole() {
  console.log = makeWrapped('INFO');
  console.info = makeWrapped('INFO');
  console.warn = makeWrapped('WARN');
  console.error = makeWrapped('ERROR');
}

function getLogsSnapshot() {
  return buffer.slice();
}

function addLogListener(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

module.exports = {
  patchConsole,
  getLogsSnapshot,
  addLogListener,
};

