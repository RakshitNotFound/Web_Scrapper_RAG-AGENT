import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ChromaClient } from 'chromadb';

dotenv.config();

// 1. Initialize Google Gemini & ChromaDB clients
const ai = new GoogleGenAI();
const chromaClient = new ChromaClient({ host: "localhost", port: 8000 });
 
// Using V3 to bypass cached/old vector data in ChromaDB
const WEB_COLLECTION = 'GITHUB_PROFILE_COLLECTION_V3';

// 2. Scrape webpage content, stripping headers/footers and isolating <main>
async function scrapeWebpage(url = '') {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);

        // Remove non-content, headers, footers, and site navigation
        $('script, style, noscript, nav, header, footer, [role="navigation"], .Header, .logged-out-header, #js-header-back-to-top-link').remove();

        // Target the main wrapper where profile details and README live
        let mainText = $('main').text();
        if (!mainText || mainText.trim().length === 0) {
            mainText = $('body').text();
        }

        const pageHead = $('head').text().replace(/\s+/g, ' ').trim();
        const pageBody = mainText.replace(/\s+/g, ' ').trim();

        const internalLinks = [];
        const externalLinks = [];

        $('a').each((_, el) => {
           const link = $(el).attr('href');
           if (!link || link === '/') return;
           if (link.startsWith('http') || link.startsWith('https')) {
              externalLinks.push(link);
           } else {
              internalLinks.push(link);
           }
        });

        return { head: pageHead, body: pageBody, internalLinks, externalLinks };
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error.message);
        return { head: '', body: '', internalLinks: [], externalLinks: [] };
    }
}

// 3. Generate vector embeddings using Google Gemini API
async function generateVectorEmbeddings({ text }) {
    if (!text) return [];
    console.log('Generating embedding via Gemini...');
    
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
    });

    return response.embeddings[0].values;
}

// 4. Insert data into ChromaDB
async function insertIntoDB({ embedding, url, head, body }) {
    const collection = await chromaClient.getOrCreateCollection({
        name: WEB_COLLECTION,
        embeddingFunction: null
    });

    await collection.add({
        ids: [`id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`],
        embeddings: [embedding],
        documents: [body || head || ''],
        metadatas: [{ url, head: head || '', body: body || '' }],
    });
}

// 5. Chunk text helper function
function chunkText(text, chunkSize) {
    if (!text || chunkSize <= 0) return [];

    const words = text.split(/\s+/);
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    return chunks;
}

// 6. Main ingestion pipeline
async function ingest(url = '') {
    console.log(`\nStarting ingestion for: ${url}`);
    const { head, body } = await scrapeWebpage(url);

    if (!body) return;

    // Split body into chunks of 2000 words and embed/insert each chunk
    const bodyChunks = chunkText(body, 2000);
    console.log(`Body split into ${bodyChunks.length} chunk(s).`);

    for (const chunk of bodyChunks) {
        const bodyEmbedding = await generateVectorEmbeddings({ text: chunk });
        if (bodyEmbedding.length > 0) {
            await insertIntoDB({ embedding: bodyEmbedding, url, head, body: chunk });
        }
    }

    console.log(`Finished ingesting: ${url}`);
}

// 7. Search function to query your GitHub profile vector data
async function searchDatabase(query = '') {
    console.log(`\n🔍 Searching GitHub profile for: "${query}"`);

    const queryEmbedding = await generateVectorEmbeddings({ text: query });

    const collection = await chromaClient.getCollection({ 
        name: WEB_COLLECTION,
        embeddingFunction: null 
    });

    const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: 2
    });

    console.log('\n--- Top Search Results from GitHub ---');
    if (results.documents && results.documents[0]) {
        results.documents[0].forEach((doc, index) => {
            console.log(`\nMatch ${index + 1}:`);
            console.log(`Source URL: ${results.metadatas[0][index].url}`);
            console.log(`Snippet: ${doc.substring(0, 300)}...`);
        });
    } else {
        console.log('No relevant matches found.');
    }

    return results;
}

// 8. Main execution flow
async function main() {
    console.log('Checking ChromaDB heartbeat...');
    const heartbeat = await chromaClient.heartbeat();
    console.log(`ChromaDB is live! Pulse timestamp: ${heartbeat}`);

    const githubProfileUrl = 'https://github.com/RakshitNotFound';

    // Ingest profile
    await ingest(githubProfileUrl);

    // Query profile
    await searchDatabase('What projects or details are on this GitHub profile?');

    console.log('\nAll done!');
}

main().catch(err => console.error('Error:', err));