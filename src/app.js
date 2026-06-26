import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  createWordCard,
  getDueWords,
  gradeSpelling,
  gradeWord,
  normalizeWord,
  translateWord,
  upsertWord
} from "./core.js";

const state = {
  view: location.hash.replace("#", "") || "home",
  words: loadJson(STORAGE_KEYS.words, []),
  stats: loadJson(STORAGE_KEYS.stats, {}),
  settings: loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  currentCard: null,
  wordSearch: "",
  selectedWordIds: [],
  reviewQueue: [],
  reviewIndex: 0,
  showAnswer: false,
  toast: "",
  reviewStartedAt: 0,
  reviewSession: {
    active: false,
    completed: false,
    target: 10,
    round: 1,
    correct: 0,
    incorrect: 0,
    total: 0
  }
};

const app = document.querySelector("#app");

window.addEventListener("hashchange", () => {
  const nextView = location.hash.replace("#", "") || "home";
  leaveReviewIfNeeded(nextView);
  state.view = nextView;
  state.showAnswer = false;
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

render();

function render() {
  const views = {
    home: renderHome,
    review: renderReview,
    words: renderWords,
    settings: renderSettings
  };

  app.innerHTML = `
    <main class="screen ${state.currentCard && state.view === "home" ? "has-result" : ""}">
      ${views[state.view]?.() || renderHome()}
    </main>
    ${renderNav()}
    ${state.toast ? `<div class="toast">${state.toast}</div>` : ""}
  `;

  bindEvents();
}

function renderHome() {
  return `
    <section class="home">
      <div class="brand-row">
        <span class="brand-dot"></span>
        <span>Daily Words</span>
      </div>
      ${renderLookupPanel()}
      ${state.currentCard ? renderWordCard(state.currentCard, true) : ""}
    </section>
  `;
}

function renderLookupPanel() {
  return `
    <form class="lookup-panel" id="lookup-form">
      <label for="word-input">查词</label>
      <div class="input-row">
        <input id="word-input" name="word" autocomplete="off" placeholder="输入英文单词或短语" required />
        <button type="submit">查询</button>
      </div>
      <button class="text-button" type="button" id="manual-save">先保存，之后补充释义</button>
    </form>
  `;
}

function renderReview() {
  if (!state.reviewSession.active) {
    return state.reviewSession.completed ? renderReviewComplete() : renderReviewStart();
  }

  const item = state.reviewQueue[state.reviewIndex];
  const card = item ? state.words.find((word) => word.id === item.cardId) : null;
  if (card && !state.reviewStartedAt) {
    state.reviewStartedAt = Date.now();
  }

  if (!card) {
    finishReviewRound();
    return renderReviewComplete();
  }

  return `
    ${renderTopbar("复习", `${state.reviewIndex + 1}/${state.reviewQueue.length}`)}
    ${renderWeeklyStats()}
    ${item.type === "flashcard" ? renderFlashcard(card) : renderSpelling(card)}
  `;
}

function renderReviewStart() {
  const defaultTarget = Math.min(Math.max(1, state.words.length), state.reviewSession.target || 10);
  return `
    ${renderTopbar("复习")}
    ${renderWeeklyStats()}
    ${state.words.length ? `
      <form class="review-start-card" id="review-start-form">
        <label for="review-target">这一轮复习多少个单词</label>
        <div class="target-row">
          <input id="review-target" name="target" type="number" min="1" max="${state.words.length}" value="${defaultTarget}" />
          <button type="submit">开始</button>
        </div>
        <p>系统会优先安排今天该复习的单词，并把闪卡和拼写打乱混合。</p>
      </form>
    ` : `
      <section class="empty-state">
        <h2>还没有可复习的单词</h2>
        <p>首页查到的新词会自动进入你的复习计划。</p>
        <button data-go="home">去查词</button>
      </section>
    `}
  `;
}

function renderReviewComplete() {
  const total = Math.max(1, state.reviewSession.total);
  const correctRate = Math.round((state.reviewSession.correct / total) * 100);
  const errorRate = 100 - correctRate;

  return `
    ${renderTopbar("复习完成")}
    ${renderWeeklyStats()}
    <section class="review-result-card">
      <p class="card-label">第 ${state.reviewSession.round} 轮</p>
      <h2>这一轮复习完了</h2>
      <div class="result-grid">
        <article>
          <strong>${correctRate}%</strong>
          <span>正确率</span>
        </article>
        <article>
          <strong>${errorRate}%</strong>
          <span>错误率</span>
        </article>
        <article>
          <strong>${state.reviewSession.total}</strong>
          <span>练习数</span>
        </article>
      </div>
      <button class="wide-button" id="continue-review">继续下一轮</button>
    </section>
  `;
}

function renderFlashcard(card) {
  return `
    <section class="review-card">
      <div class="review-card-head">
        <p class="card-label">先想意思</p>
        ${renderSoundButton(card)}
      </div>
      <h2>${escapeHtml(card.word)}</h2>
      ${state.showAnswer ? `
        <p class="meaning">${escapeHtml(card.meaning_zh)}</p>
        ${renderExample(card)}
      ` : `<button class="wide-button" id="show-answer">显示答案</button>`}
    </section>
    ${state.showAnswer ? `
      <section class="grade-row">
        <button data-grade="again">不认识</button>
        <button data-grade="hard">模糊</button>
        <button data-grade="easy">认识</button>
      </section>
    ` : ""}
  `;
}

function renderSpelling(card) {
  return `
    <section class="review-card">
      <div class="review-card-head">
        <p class="card-label">拼写练习</p>
        ${renderSoundButton(card)}
      </div>
      <p class="meaning">${escapeHtml(card.meaning_zh)}</p>
      ${card.example_zh ? `<p class="example-zh">${escapeHtml(card.example_zh)}</p>` : ""}
      <form id="spelling-form" class="spelling-form">
        <input name="spelling" autocomplete="off" placeholder="输入英文" />
        <button type="submit">检查</button>
      </form>
    </section>
  `;
}

function renderWords() {
  const filteredWords = getFilteredWords();
  const selectedCount = state.selectedWordIds.length;

  return `
    ${renderTopbar("单词", state.words.length)}
    <section class="word-tools">
      <input id="word-search" value="${escapeHtml(state.wordSearch)}" placeholder="搜索要管理的单词" autocomplete="off" />
      <div class="selection-bar">
        <span>${filteredWords.length} 个结果 · 已选 ${selectedCount}</span>
        <button id="delete-selected" ${selectedCount ? "" : "disabled"}>删除</button>
      </div>
    </section>
    <section class="word-list">
      ${filteredWords.length ? filteredWords.map((word) => renderManageableWordCard(word)).join("") : `
        <div class="empty-state">
          <h2>${state.words.length ? "没有找到这个单词" : "还没有单词"}</h2>
          <p>${state.words.length ? "换一个关键词试试。" : "回到首页输入第一个生活里遇到的生词。"}</p>
          ${state.words.length ? "" : `<button data-go="home">去查词</button>`}
        </div>
      `}
    </section>
  `;
}

function renderManageableWordCard(card) {
  const checked = state.selectedWordIds.includes(card.id) ? "checked" : "";
  return `
    <article class="word-card manageable-word">
      <label class="select-word">
        <input type="checkbox" data-select-word="${escapeHtml(card.id)}" ${checked} />
        <span></span>
      </label>
      ${renderWordCardContent(card)}
    </article>
  `;
}

function renderSettings() {
  return `
    ${renderTopbar("设置")}
    <form class="settings-form" id="settings-form">
      <label>
        每日复习时长
        <input name="dailyMinutes" type="number" min="5" max="240" step="5" value="${state.settings.dailyMinutes}" />
      </label>
      <label>
        翻译接口
        <input name="translationEndpoint" value="${escapeHtml(state.settings.translationEndpoint)}" />
      </label>
      <label>
        英文词典接口
        <input name="dictionaryEndpoint" value="${escapeHtml(state.settings.dictionaryEndpoint || DEFAULT_SETTINGS.dictionaryEndpoint)}" />
      </label>
      <label>
        接口密钥
        <input name="translationApiKey" type="password" value="${escapeHtml(state.settings.translationApiKey)}" placeholder="可选" />
      </label>
      <button type="submit">保存设置</button>
    </form>
    <section class="settings-actions">
      <button id="export-words">导出单词</button>
      <button class="danger" id="clear-words">清空本地数据</button>
    </section>
  `;
}

function renderTopbar(title, meta = "") {
  return `
    <section class="topbar">
      <h1>${title}</h1>
      ${meta !== "" ? `<span class="pill">${meta}</span>` : ""}
    </section>
  `;
}

function renderWeeklyStats() {
  const days = getWeekDays();
  const maxMinutes = Math.max(10, ...days.map((day) => Math.ceil(getReviewSeconds(day.key) / 60)));
  return `
    <section class="week-panel">
      <div class="week-panel-head">
        <h2>本周</h2>
        <span>${formatMinutes(days.reduce((total, day) => total + getReviewSeconds(day.key), 0))}</span>
      </div>
      <div class="week-grid">
        ${days.map((day) => {
          const minutes = Math.round(getReviewSeconds(day.key) / 60);
          const added = getNewWordsCount(day.key);
          const height = Math.max(8, Math.round((minutes / maxMinutes) * 42));
          return `
            <article class="${day.isToday ? "today" : ""}">
              <div class="bar-track"><span style="height:${height}px"></span></div>
              <strong>${day.label}</strong>
              <small>${minutes}m · +${added}</small>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderWordCard(card, featured) {
  return `
    <article class="word-card ${featured ? "featured" : ""}">
      ${renderWordCardContent(card)}
    </article>
  `;
}

function renderWordCardContent(card) {
  return `
    <div class="word-card-content">
      <div class="word-title">
        <div>
          <h2>${escapeHtml(card.word)}</h2>
          <span>${escapeHtml(card.part_of_speech)}</span>
        </div>
        ${renderSoundButton(card)}
      </div>
      <p class="meaning">${escapeHtml(card.meaning_zh)}</p>
      ${card.definition_en ? `<p class="definition">${escapeHtml(card.definition_en)}</p>` : ""}
      ${renderExample(card)}
      <div class="card-meta">
        <span>熟悉度 ${Number(card.familiarity_level || 0)}</span>
        <span>错误 ${Number(card.mistake_count || 0)}</span>
      </div>
    </div>
  `;
}

function renderExample(card) {
  if (!card.example_en && !card.example_zh) return "";
  return `
    <div class="example-block">
      ${card.example_en ? `<p class="example">${escapeHtml(card.example_en)}</p>` : ""}
      ${card.example_zh ? `<p class="example-zh">${escapeHtml(card.example_zh)}</p>` : ""}
    </div>
  `;
}

function renderSoundButton(card) {
  return `
    <button class="sound-button" type="button" data-speak="${escapeHtml(card.word)}" data-audio="${escapeHtml(card.audio_url || "")}" aria-label="播放读音">
      ${speakerIcon()}
    </button>
  `;
}

function speakerIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z"></path>
      <path d="M16 8.5c.9.9 1.4 2.1 1.4 3.5s-.5 2.6-1.4 3.5"></path>
      <path d="M18.6 6c1.5 1.6 2.4 3.6 2.4 6s-.9 4.4-2.4 6"></path>
    </svg>
  `;
}

function renderNav() {
  const items = [
    ["home", "首页"],
    ["review", "复习"],
    ["words", "单词"],
    ["settings", "设置"]
  ];

  return `
    <nav class="bottom-nav" aria-label="主导航">
      ${items.map(([view, label]) => `
        <button class="${state.view === view ? "active" : ""}" data-go="${view}">
          ${label}
        </button>
      `).join("")}
    </nav>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => go(button.dataset.go));
  });

  document.querySelectorAll("[data-speak]").forEach((button) => {
    button.addEventListener("click", () => speakWord(button.dataset.speak, button.dataset.audio));
  });

  document.querySelectorAll("[data-select-word]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => toggleWordSelection(checkbox.dataset.selectWord, checkbox.checked));
  });

  document.querySelector("#word-search")?.addEventListener("input", (event) => {
    state.wordSearch = event.target.value;
    render();
  });

  document.querySelector("#delete-selected")?.addEventListener("click", handleDeleteSelected);
  document.querySelector("#review-start-form")?.addEventListener("submit", handleStartReview);
  document.querySelector("#continue-review")?.addEventListener("click", handleContinueReview);
  document.querySelector("#lookup-form")?.addEventListener("submit", handleLookup);
  document.querySelector("#manual-save")?.addEventListener("click", handleManualSave);
  document.querySelector("#show-answer")?.addEventListener("click", () => {
    state.showAnswer = true;
    render();
  });

  document.querySelectorAll("[data-grade]").forEach((button) => {
    button.addEventListener("click", () => handleGrade(button.dataset.grade));
  });

  document.querySelector("#spelling-form")?.addEventListener("submit", handleSpelling);
  document.querySelector("#settings-form")?.addEventListener("submit", handleSettings);
  document.querySelector("#export-words")?.addEventListener("click", handleExport);
  document.querySelector("#clear-words")?.addEventListener("click", handleClear);
}

async function handleLookup(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const word = form.get("word");
  showToast("正在查询并保存...");

  try {
    const translation = await translateWord(word, state.settings);
    saveCard(createWordCard(word, translation));
    showToast("已保存到单词本");
  } catch {
    showToast("翻译失败，可以先手动保存");
  }
}

function handleManualSave() {
  const input = document.querySelector("#word-input");
  if (!input?.value) {
    showToast("先输入一个单词");
    return;
  }
  saveCard(createWordCard(input.value));
  showToast("已手动保存");
}

function handleStartReview(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  startReviewRound(Number(form.get("target") || state.reviewSession.target || 10), false);
}

function handleContinueReview() {
  startReviewRound(state.reviewSession.target, true);
}

function startReviewRound(target, nextRound) {
  const cards = pickReviewCards(target);
  if (!cards.length) {
    showToast("还没有可复习的单词");
    return;
  }

  state.reviewQueue = buildMixedReviewQueue(cards);
  state.reviewIndex = 0;
  state.showAnswer = false;
  state.reviewStartedAt = 0;
  state.reviewSession = {
    active: true,
    completed: false,
    target: Math.min(Math.max(1, Number(target || 10)), state.words.length),
    round: nextRound ? state.reviewSession.round + 1 : 1,
    correct: 0,
    incorrect: 0,
    total: 0
  };
  render();
}

function saveCard(card) {
  const result = upsertWord(state.words, card);
  state.words = result.words;
  state.currentCard = result.card;
  state.reviewQueue = [];
  persist();
  render();
}

function handleGrade(grade) {
  const current = getCurrentReviewCard();
  if (!current) return;
  recordReviewTime();
  recordReviewAnswer(grade === "easy");
  updateWord(gradeWord(current, grade));
  nextReviewItem();
}

function handleSpelling(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const current = getCurrentReviewCard();
  if (!current) return;
  const result = gradeSpelling(current, form.get("spelling"));
  recordReviewTime();
  recordReviewAnswer(result.isCorrect);
  updateWord(result.card);
  showToast(result.isCorrect ? "拼对了" : `正确答案是 ${current.word}`);
  nextReviewItem();
}

function handleSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.settings = {
    dailyMinutes: Number(form.get("dailyMinutes") || 30),
    translationEndpoint: String(form.get("translationEndpoint") || DEFAULT_SETTINGS.translationEndpoint),
    dictionaryEndpoint: String(form.get("dictionaryEndpoint") || DEFAULT_SETTINGS.dictionaryEndpoint),
    translationApiKey: String(form.get("translationApiKey") || "")
  };
  state.reviewQueue = [];
  persist();
  showToast("设置已保存");
  render();
}

function handleExport() {
  const blob = new Blob([JSON.stringify(state.words, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "daily-words-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

function handleClear() {
  if (!confirm("确定要清空所有本地单词吗？")) return;
  state.words = [];
  state.currentCard = null;
  state.reviewQueue = [];
  state.selectedWordIds = [];
  persist();
  render();
}

function handleDeleteSelected() {
  if (!state.selectedWordIds.length) return;
  const count = state.selectedWordIds.length;
  if (!confirm(`确定删除选中的 ${count} 个单词吗？`)) return;
  const selected = new Set(state.selectedWordIds);
  state.words = state.words.filter((word) => !selected.has(word.id));
  if (state.currentCard && selected.has(state.currentCard.id)) {
    state.currentCard = null;
  }
  state.selectedWordIds = [];
  state.reviewQueue = state.reviewQueue.filter((item) => !selected.has(item.cardId));
  persist();
  showToast(`已删除 ${count} 个单词`);
  render();
}

function toggleWordSelection(wordId, selected) {
  const next = new Set(state.selectedWordIds);
  if (selected) {
    next.add(wordId);
  } else {
    next.delete(wordId);
  }
  state.selectedWordIds = [...next];
  render();
}

function speakWord(word, audioUrl = "") {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch(() => speakWithDeviceVoice(word));
    return;
  }
  speakWithDeviceVoice(word);
}

function speakWithDeviceVoice(word) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showToast("当前设备暂不支持播放读音");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function pickReviewCards(target) {
  const limit = Math.min(Math.max(1, Number(target || 10)), state.words.length);
  const due = getDueWords(state.words, new Date(), limit * 3);
  const picked = new Map(due.map((word) => [word.id, word]));
  const remaining = shuffleArray(state.words.filter((word) => !picked.has(word.id)));

  for (const word of remaining) {
    if (picked.size >= limit) break;
    picked.set(word.id, word);
  }

  return shuffleArray([...picked.values()]).slice(0, limit);
}

function buildMixedReviewQueue(cards) {
  const tasks = shuffleArray(cards.flatMap((card) => [
    { type: "flashcard", cardId: card.id },
    { type: "spelling", cardId: card.id }
  ]));
  const queue = [];

  while (tasks.length) {
    const previous = queue[queue.length - 1];
    let index = tasks.findIndex((task) => task.cardId !== previous?.cardId);
    if (index < 0) index = 0;
    queue.push(tasks.splice(index, 1)[0]);
  }

  return queue;
}

function getFilteredWords() {
  const keyword = normalizeWord(state.wordSearch);
  if (!keyword) return state.words;
  return state.words.filter((word) => {
    const haystack = [
      word.word,
      word.meaning_zh,
      word.definition_en,
      word.example_en,
      word.example_zh
    ].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
}

function getCurrentReviewCard() {
  const item = state.reviewQueue[state.reviewIndex];
  return item ? state.words.find((word) => word.id === item.cardId) : null;
}

function nextReviewItem() {
  state.reviewIndex += 1;
  state.showAnswer = false;
  state.reviewStartedAt = 0;
  if (state.reviewIndex >= state.reviewQueue.length) {
    finishReviewRound();
  }
  render();
}

function finishReviewRound() {
  recordReviewTime();
  state.reviewSession.active = false;
  state.reviewSession.completed = true;
  state.reviewStartedAt = 0;
}

function recordReviewAnswer(isCorrect) {
  state.reviewSession.total += 1;
  if (isCorrect) {
    state.reviewSession.correct += 1;
  } else {
    state.reviewSession.incorrect += 1;
  }
}

function updateWord(updatedCard) {
  state.words = state.words.map((word) => word.id === updatedCard.id ? updatedCard : word);
  persist();
}

function go(view) {
  leaveReviewIfNeeded(view);
  state.view = view;
  location.hash = view;
  render();
}

function leaveReviewIfNeeded(nextView) {
  if (state.view === "review" && nextView !== "review") {
    recordReviewTime();
    state.reviewStartedAt = 0;
  }
}

function recordReviewTime() {
  if (!state.reviewStartedAt) return;
  const seconds = Math.max(1, Math.round((Date.now() - state.reviewStartedAt) / 1000));
  const key = dateKey(new Date());
  state.stats[key] = {
    ...state.stats[key],
    reviewSeconds: Number(state.stats[key]?.reviewSeconds || 0) + seconds
  };
  state.reviewStartedAt = Date.now();
  persist();
}

function getReviewSeconds(key) {
  return Number(state.stats[key]?.reviewSeconds || 0);
}

function getNewWordsCount(key) {
  return state.words.filter((word) => dateKey(new Date(word.created_at)) === key).length;
}

function getWeekDays(now = new Date()) {
  const start = new Date(now);
  const day = start.getDay() || 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day + 1);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return labels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: dateKey(date),
      label,
      isToday: dateKey(date) === dateKey(now)
    };
  });
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMinutes(seconds) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} 分钟`;
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.words, JSON.stringify(state.words));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(state.stats));
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function showToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
