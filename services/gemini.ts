import { ImageSize, LearnVideo, ParentSettings, ActivityLog, Book, Story, FeedItem, GroundingChunk } from "../types";

// --- CONFIGURATION ---
const OLLAMA_URL = "http://localhost:11434/api/generate";
const COMFYUI_URL = "http://localhost:8188";
const DEFAULT_MODEL = "qwen2.5"; // Matches app.py configuration

// Mock types to maintain compatibility with the rest of the app
export enum Type {
    OBJECT = "OBJECT",
    ARRAY = "ARRAY",
    STRING = "STRING"
}
export enum Modality {
    AUDIO = "AUDIO"
}

const memoryCache = new Map<string, any>();
const getFromCache = (key: string) => memoryCache.get(key);
const setInCache = (key: string, value: any) => {
    if (memoryCache.size > 50) memoryCache.delete(memoryCache.keys().next().value);
    memoryCache.set(key, value);
};

// --- CORE LOCAL AI LOGIC ---

const callOllama = async (prompt: string, jsonMode: boolean = false) => {
    const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: DEFAULT_MODEL,
            prompt: prompt,
            stream: false,
            format: jsonMode ? 'json' : undefined
        })
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    const data = await response.json();
    return data.response;
};

// --- CORE STREAMING LOGIC ---
export const askProfessorStream = async (q: string, onChunk: (text: string) => void) => {
    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                prompt: q,
                stream: true,
            })
        });

        if (!response.ok) throw new Error("Could not connect to Ollama");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        let fullText = '';
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const data = JSON.parse(line);
                    if (data.response) {
                        fullText += data.response;
                        onChunk(fullText);
                    }
                } catch (e) { /* partial chunk */ }
            }
        }
        
        let imageUrl: string | null = null;
        if (q.toLowerCase().match(/draw|picture|show me|how does/)) {
            imageUrl = await generateImage(`Educational 3D illustration of ${q} for kids`, ImageSize.S_1K);
        }
        
        return { text: fullText, imageUrl };
    } catch (e) {
        console.error("Local streaming error", e);
        return { text: "Hoot! My local brain is taking a nap. Is Ollama running on your device?", imageUrl: null };
    }
};

// --- PREDICTIVE TRACK GENERATION ---
export const generatePredictivePackage = async (
    currentTopic: string,
    settings: ParentSettings | null,
    recommendation: any
): Promise<Partial<FeedItem>[]> => {
    try {
        const prompt = `Generate a package of 3 future educational topics related to "${currentTopic}" for a ${settings?.childAge || 5} year old. Recommendation: ${recommendation.reason}. Return JSON list of {title, fact, topic}. Facts must be under 15 words.`;
        const responseText = await callOllama(prompt, true);
        const data = JSON.parse(responseText || '[]');
        return data.map((item: any) => ({
            ...item,
            id: `pred-${Math.random()}`,
            hydrationStatus: 'EMPTY'
        }));
    } catch (e) {
        console.error("Package gen error", e);
        return [];
    }
};

// --- FAST LESSON GENERATION ---
export const generateLessonFast = async (topic: string) => {
    try {
        const prompt = `Write an educational 3-sentence fun script for kids about ${topic} and 3 short image prompts. Return JSON { "script": "...", "visualPrompts": ["...", "..."] }.`;
        const responseText = await callOllama(prompt, true);
        return JSON.parse(responseText || '{}');
    } catch (e) {
        return { script: "Let's learn together!", visualPrompts: [topic] };
    }
};

// --- IMAGE GENERATION (ComfyUI) ---
export const generateImage = async (prompt: string, size: ImageSize): Promise<string | null> => {
  const cacheKey = `img-${prompt}-${size}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    // ComfyUI Workflow (Simplified)
    const workflow = {
      "3": { "class_type": "KSampler", "inputs": { "cfg": 7, "denoise": 1, "latent_image": ["5", 0], "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0], "sampler_name": "euler", "scheduler": "normal", "seed": Math.floor(Math.random() * 1000000), "steps": 20 } },
      "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" } },
      "5": { "class_type": "EmptyLatentImage", "inputs": { "batch_size": 1, "height": 512, "width": 512 } },
      "6": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": prompt } },
      "7": { "class_type": "CLIPTextEncode", "inputs": { "clip": ["4", 1], "text": "ugly, blurry, low quality, deformed, disfigured" } },
      "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
      "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "kidos_gen", "images": ["8", 0] } }
    };

    const queueResponse = await fetch(`${COMFYUI_URL}/prompt`, {
        method: 'POST',
        body: JSON.stringify({ prompt: workflow, client_id: "kidos_client" })
    });
    
    const { prompt_id } = await queueResponse.json();
    
    // Poll for results
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const historyResponse = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
        const history = await historyResponse.json();
        if (history[prompt_id]) {
            const outputs = history[prompt_id].outputs;
            const images = outputs["9"].images;
            const img = images[0];
            const imgUrl = `${COMFYUI_URL}/view?filename=${img.filename}&type=${img.type}&subfolder=${img.subfolder}`;
            setInCache(cacheKey, imgUrl);
            return imgUrl;
        }
    }
    return null;
  } catch (e) { 
      console.error("Image gen error", e);
      return null; 
  }
};

// --- SPEECH GENERATION (WEB SPEECH API fallback for local) ---
export const generateSpeech = async (text: string): Promise<string> => {
    return ''; 
}

export const getWavUrl = (base64Pcm: string): string => "";

// --- UTILITIES & ACTIVITY LOGGING ---
export const logActivity = (type: string, details: string, category: string) => {
    console.log(`[WonderLog] ${category}: ${details} (${type})`);
};

export const getBuddyMessage = async (context: any, settings: any, isDirect: boolean = false) => {
    try {
        const prompt = isDirect 
            ? `As a friendly owl tutor, talk to a ${settings?.childAge || 5} year old child about: ${context}. Keep it under 2 sentences.`
            : `Provide a 1-sentence fun tip for a kid currently learning about ${context}.`;
        
        return await callOllama(prompt);
    } catch (e) { return "Hoot! Having fun yet?"; }
};

// --- SEARCH & PARENT TOOLS ---
export const searchCurriculum = async (q: string): Promise<{ text: string, sources: GroundingChunk[] }> => { 
    try {
        const text = await callOllama(`Search-style answer for: ${q}`);
        return { text, sources: [] }; 
    } catch (e) { return { text: "Couldn't search right now.", sources: [] }; }
}

export const generateParentInsights = async (logs: ActivityLog[], settings: ParentSettings) => {
    try {
        const prompt = `Analyze these activity logs for ${settings.childName}: ${JSON.stringify(logs)}. Provide a helpful 3-sentence summary of their learning interests.`;
        return await callOllama(prompt);
    } catch (e) { return "Insights are currently unavailable."; }
};

export const promptForKey = async () => { /* No key needed for local */ }

// --- LEGACY/STUB EXPORTS FOR COMPONENTS ---
export const generateLearnTopics = async (settings?: ParentSettings): Promise<LearnVideo[]> => {
    try {
        const prompt = `Generate 4 educational video topics for a ${settings?.childAge || 5} year old. Return JSON [{id, title, description, category}].`;
        const res = await callOllama(prompt, true);
        return JSON.parse(res || '[]');
    } catch (e) { return []; }
}

export const generateFunFact = async (topic: string, settings?: ParentSettings) => {
    try {
        const prompt = `Write a 1-sentence funny kid fact about ${topic}. Age: ${settings?.childAge || 5}.`;
        return await callOllama(prompt);
    } catch (e) { return "Did you know learning is fun?"; }
};

export const identifyDrawing = async (base64Image: string) => "That's a beautiful drawing!";
export const getChessAdvice = async (boardState: string) => "Try to control the center of the board!";
export const generateLanguageLesson = async (lang: string, difficulty: string) => ({});
export const checkPronunciation = async (text: string, audioData: string) => ({ correct: true });
export const generateLibrary = async () => [];
export const generateStory = async (title: string) => ({ title, coverPrompt: "", pages: [] });
export const generateRelatedTopics = async (topic: string) => [];
export const generateLessonScript = async (topic: string) => ({ script: "", visualPrompts: [] });
export const askProfessor = async (q: string) => {
    const res = await askProfessorStream(q, () => {});
    return res;
};
