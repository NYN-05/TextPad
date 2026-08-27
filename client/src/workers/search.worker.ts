interface SearchMatch {
  fileId: string;
  fileName: string;
  line: number;
  text: string;
}

interface CorpusFile {
  id: string;
  name: string;
  content: string;
}

let corpus: CorpusFile[] = [];

function runSearch(query: string, max: number): SearchMatch[] {
  const q = query.toLowerCase();
  const results: SearchMatch[] = [];
  for (const f of corpus) {
    if (results.length >= max) break;
    if (!f.content) continue;
    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        results.push({ fileId: f.id, fileName: f.name, line: i + 1, text: lines[i].trim() });
        if (results.length >= max) break;
      }
    }
  }
  return results;
}

self.onmessage = (event: MessageEvent<{ type: string; id?: number; query?: string; max?: number; files?: CorpusFile[] }>) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === "SET_FILES") {
    corpus = msg.files ?? [];
    return;
  }
  if (msg.type === "SEARCH") {
    const results = runSearch(String(msg.query ?? ""), msg.max ?? 200);
    self.postMessage({ id: msg.id, results });
  }
};
