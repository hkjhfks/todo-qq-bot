function getEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value;
}

function getConfigFromEnv() {
  const HF_TOKEN = getEnv('HF_TOKEN');
  const HF_REPO_ID = getEnv('HF_REPO_ID') || getEnv('SPACE_ID');
  const HF_REPO_TYPE = getEnv('HF_REPO_TYPE', 'dataset');
  const HF_REPO_FILE = getEnv('HF_REPO_FILE', 'data/todos.json');

  if (!HF_TOKEN || !HF_REPO_ID) {
    throw new Error('HF_TOKEN 和 HF_REPO_ID/SPACE_ID 必须配置，用于读取 todos dataset');
  }

  return {
    HF_TOKEN,
    HF_REPO_ID,
    HF_REPO_TYPE,
    HF_REPO_FILE,
  };
}

function normalizeState(raw) {
  if (Array.isArray(raw)) {
    return { todos: raw, groups: [] };
  }
  if (raw && typeof raw === 'object') {
    const todos = Array.isArray(raw.todos) ? raw.todos : [];
    const groups = Array.isArray(raw.groups) ? raw.groups : [];
    return { todos, groups };
  }
  return { todos: [], groups: [] };
}

async function readTodosFromDataset() {
  const { HF_TOKEN, HF_REPO_ID, HF_REPO_TYPE, HF_REPO_FILE } = getConfigFromEnv();

  // 这里直接用 huggingface/hub 的 downloadFile，与 TODO 后端逻辑保持一致
  const { downloadFile } = await import('@huggingface/hub');

  const repo = { type: HF_REPO_TYPE, name: HF_REPO_ID };
  const response = await downloadFile({
    repo,
    path: HF_REPO_FILE,
    accessToken: HF_TOKEN,
  });
  const raw = await response.text();
  const state = normalizeState(JSON.parse(raw));
  return state.todos || [];
}

module.exports = {
  readTodosFromDataset,
};
