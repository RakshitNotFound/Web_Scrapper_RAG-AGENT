# 🤖 Ask Your GitHub Profile — AI-Powered RAG Agent

An end-to-end Retrieval-Augmented Generation (RAG) agent built with Node.js that scrapes developer profiles, extracts relevant metadata, generates vector embeddings using Google Gemini, and enables low-latency natural language querying via ChromaDB.

---

## 🌟 Key Features

* **DOM Filtering & Web Scraping:** Cleanly isolates core content (bios, repositories, pinned projects) using `axios` and `cheerio` while stripping out global navigation menus and boilerplate markup.
* **Vector Embeddings via Google Gemini:** Utilizes the `@google/genai` SDK (`gemini-embedding-001`) to convert profile text into vector representations.
* **Local Vector Storage:** Connects with a containerized **ChromaDB** instance to persist and query vector collections.
* **Semantic Search:** Performs similarity searches over stored embeddings to accurately retrieve context matching natural language queries.
* **Chunking Strategy:** Implements text chunking to keep ingested documents within optimal vector embedding window sizes.

---

## 🛠️ Tech Stack

* **Runtime:** Node.js (ES Modules)
* **Web Scraping:** `axios`, `cheerio`
* **AI & Embeddings:** `@google/genai` (Google Gemini API)
* **Vector Database:** `chromadb` (Docker container)
* **Environment Management:** `dotenv`

---

## 📐 Pipeline Architecture

[ GitHub Profile ] ──( Axios/Cheerio )──> [ Filtered Text ]
│
( Text Chunking )
│
▼
[ ChromaDB Storage ] <──( Gemini Vectors )── [ Gemini Embeddings ]
│
├──( User Search Query )
▼
[ Contextual Top Matches ]
