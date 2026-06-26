export const STORAGE_KEYS = {
  words: "daily_words.words.v1",
  settings: "daily_words.settings.v1",
  stats: "daily_words.stats.v1"
};

export const DEFAULT_SETTINGS = {
  dailyMinutes: 30,
  translationEndpoint: "https://api.mymemory.translated.net/get",
  dictionaryEndpoint: "https://api.dictionaryapi.dev/api/v2/entries/en",
  translationApiKey: ""
};

const fallbackCards = {
  serendipity: {
    meaning_zh: "意外发现美好事物的能力；机缘巧合",
    definition_en: "The occurrence of events by chance in a happy or beneficial way.",
    part_of_speech: "noun",
    example_en: "Finding that quiet bookstore was pure serendipity.",
    example_zh: "找到那家安静的书店纯属机缘巧合。",
    audio_url: ""
  },
  resilient: {
    meaning_zh: "有韧性的；能快速恢复的",
    definition_en: "Able to recover quickly after difficulty.",
    part_of_speech: "adjective",
    example_en: "She stayed resilient after a difficult week.",
    example_zh: "经历艰难的一周后，她依然很有韧性。",
    audio_url: ""
  },
  wander: {
    meaning_zh: "漫步；徘徊；走神",
    definition_en: "To walk or move in a relaxed way without a fixed direction.",
    part_of_speech: "verb",
    example_en: "I like to wander through new streets after work.",
    example_zh: "下班后我喜欢在陌生街道上闲逛。",
    audio_url: ""
  }
};

export function createWordCard(input, translation = {}) {
  const now = new Date().toISOString();
  const word = normalizeWord(input);

  return {
    id: `${word}-${Date.now()}`,
    word,
    meaning_zh: translation.meaning_zh || "等待补充释义",
    definition_en: translation.definition_en || "",
    part_of_speech: translation.part_of_speech || "unknown",
    example_en: translation.example_en || "",
    example_zh: translation.example_zh || "",
    audio_url: translation.audio_url || "",
    created_at: now,
    last_reviewed_at: "",
    next_review_at: now,
    familiarity_level: 0,
    mistake_count: 0
  };
}

export function normalizeWord(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function upsertWord(words, newCard) {
  const existingIndex = words.findIndex((item) => normalizeWord(item.word) === normalizeWord(newCard.word));

  if (existingIndex >= 0) {
    const merged = [...words];
    merged[existingIndex] = {
      ...merged[existingIndex],
      ...newCard,
      id: merged[existingIndex].id,
      created_at: merged[existingIndex].created_at,
      last_reviewed_at: merged[existingIndex].last_reviewed_at,
      next_review_at: merged[existingIndex].next_review_at,
      familiarity_level: merged[existingIndex].familiarity_level,
      mistake_count: merged[existingIndex].mistake_count
    };
    return { words: merged, card: merged[existingIndex], created: false };
  }

  return { words: [newCard, ...words], card: newCard, created: true };
}

export function getDueWords(words, now = new Date(), dailyMinutes = 30) {
  const targetCount = Math.max(5, Math.round(Number(dailyMinutes || 30) / 3));
  return words
    .filter((word) => !word.next_review_at || new Date(word.next_review_at) <= now)
    .sort((a, b) => {
      const aScore = Number(a.familiarity_level || 0) - Number(a.mistake_count || 0);
      const bScore = Number(b.familiarity_level || 0) - Number(b.mistake_count || 0);
      return aScore - bScore;
    })
    .slice(0, targetCount);
}

export function gradeWord(card, grade, now = new Date()) {
  const next = new Date(now);
  let familiarity = Number(card.familiarity_level || 0);
  let mistakes = Number(card.mistake_count || 0);

  if (grade === "again") {
    next.setMinutes(next.getMinutes() + 10);
    familiarity = Math.max(0, familiarity - 1);
    mistakes += 1;
  } else if (grade === "hard") {
    next.setDate(next.getDate() + 1);
    familiarity = Math.max(1, familiarity);
  } else {
    const gapDays = Math.min(14, 2 + familiarity * 2);
    next.setDate(next.getDate() + gapDays);
    familiarity += 1;
  }

  return {
    ...card,
    familiarity_level: familiarity,
    mistake_count: mistakes,
    last_reviewed_at: now.toISOString(),
    next_review_at: next.toISOString()
  };
}

export function gradeSpelling(card, typed, now = new Date()) {
  const isCorrect = normalizeWord(typed) === normalizeWord(card.word);
  return {
    card: gradeWord(card, isCorrect ? "easy" : "again", now),
    isCorrect
  };
}

export async function translateWord(input, settings = DEFAULT_SETTINGS, fetchImpl = fetch) {
  const word = normalizeWord(input);
  if (!word) {
    throw new Error("请输入要查询的单词");
  }

  const fallback = fallbackCards[word];
  const dictionary = await fetchDictionaryEntry(word, settings, fetchImpl).catch(() => null);
  const definition = dictionary?.definition || fallback?.definition_en || "";
  const example = dictionary?.example || fallback?.example_en || "";
  const sourceMeaning = definition || word;
  const sourceExample = example || "";

  try {
    const [meaningZh, exampleZh] = await Promise.all([
      translateText(sourceMeaning, settings, fetchImpl),
      sourceExample ? translateText(sourceExample, settings, fetchImpl) : Promise.resolve("")
    ]);

    return {
      meaning_zh: meaningZh || fallback?.meaning_zh || sourceMeaning,
      definition_en: definition,
      part_of_speech: dictionary?.partOfSpeech || fallback?.part_of_speech || "unknown",
      example_en: sourceExample,
      example_zh: exampleZh || fallback?.example_zh || "",
      audio_url: dictionary?.audio || fallback?.audio_url || ""
    };
  } catch (error) {
    if (fallback) return fallback;
    if (dictionary) {
      return {
        meaning_zh: definition || word,
        definition_en: definition,
        part_of_speech: dictionary.partOfSpeech || "unknown",
        example_en: sourceExample,
        example_zh: "",
        audio_url: dictionary.audio || ""
      };
    }
    throw error;
  }
}

async function fetchDictionaryEntry(word, settings, fetchImpl) {
  const base = settings.dictionaryEndpoint || DEFAULT_SETTINGS.dictionaryEndpoint;
  const response = await fetchImpl(`${base}/${encodeURIComponent(word)}`);
  if (!response.ok) throw new Error("dictionary failed");
  const data = await response.json();
  const entry = Array.isArray(data) ? data[0] : null;
  const phonetics = entry?.phonetics || [];
  const audio = phonetics.find((item) => item.audio)?.audio || "";

  for (const meaning of entry?.meanings || []) {
    for (const definition of meaning.definitions || []) {
      if (definition.definition) {
        return {
          partOfSpeech: meaning.partOfSpeech || "unknown",
          definition: definition.definition,
          example: definition.example || "",
          audio
        };
      }
    }
  }

  throw new Error("empty dictionary entry");
}

async function translateText(text, settings, fetchImpl) {
  const endpoint = settings.translationEndpoint || DEFAULT_SETTINGS.translationEndpoint;
  const url = new URL(endpoint);
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", "en|zh-CN");
  if (settings.translationApiKey) {
    url.searchParams.set("key", settings.translationApiKey);
  }

  const response = await fetchImpl(url.toString());
  if (!response.ok) throw new Error("translation failed");
  const data = await response.json();
  return cleanTranslation(data?.responseData?.translatedText || "");
}

function cleanTranslation(value) {
  return String(value || "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .trim();
}
