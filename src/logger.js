const MAX_LINES = 500;

const buffer = [];
const listeners = new Set();

// 记录原始输出函数，便于在 hook 后继续写入容器 stdout/stderr，
// 这样 docker logs 的行为保持不变。
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

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

function patchConsole() {
  // 按行拦截 stdout/stderr，尽量还原 docker logs 的内容。
  function createWriteWrapper(originalWrite) {
    let pending = '';

    return function write(chunk, encoding, callback) {
      const str =
        typeof chunk === 'string'
          ? chunk
          : chunk.toString(
              typeof encoding === 'string' && encoding
                ? encoding
                : 'utf8'
            );

      pending += str;

      let idx;
      while ((idx = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, idx);
        pending = pending.slice(idx + 1);
        pushLine(line);
      }

      return originalWrite(chunk, encoding, callback);
    };
  }

  process.stdout.write = createWriteWrapper(originalStdoutWrite);
  process.stderr.write = createWriteWrapper(originalStderrWrite);
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
