
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { ImageSize, LearnVideo, ParentSettings, ActivityLog, Book, Story, FeedItem, GroundingChunk } from "../types";

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const memoryCache = new Map<string, any>();
const getFromCache = (key: string) => memoryCache.get(key);
const setInCache = (key: string, value: any) => {
    if (memoryCache.size > 50) memoryCache.delete(memoryCache.keys().next().value);
    memoryCache.set(key, value);
};

// --- CORE STREAMING LOGIC ---
export const askProfessorStream = async (q: string, onChunk: (text: string) => void) => {
    try {
        const ai = getAi();
        const result = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: q,
        });

        let fullText = '';
        for await (const chunk of result) {
            const text = (chunk as GenerateContentResponse).text;
            if (text) {
                fullText += text;
                onChunk(fullText);
            }
        }
        
        // Background Image Generation (Optional background task)
        let imageUrl: string | null = null;
        if (q.toLowerCase().match(/draw|picture|show me|how does/)) {
            imageUrl = await generateImage(`Educational 3D illustration of ${q} for kids`, ImageSize.S_1K);
        }
        
        return { text: fullText, imageUrl };
    } catch (e) {
        console.error("Streaming error", e);
        return { text: "Oh feathers! My crystal ball is a bit foggy. Try again?", imageUrl: null };
    }
};

// --- PREDICTIVE TRACK GENERATION ---
export const generatePredictivePackage = async (
    currentTopic: string,
    settings: ParentSettings | null,
    recommendation: any
): Promise<Partial<FeedItem>[]> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate a package of 3 future educational topics related to "${currentTopic}" for a ${settings?.childAge || 5} year old. Recommendation: ${recommendation.reason}. Return JSON list of {title, fact, topic}. Facts must be under 15 words.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            fact: { type: Type.STRING },
                            topic: { type: Type.STRING }
                        },
                        required: ['title', 'fact', 'topic']
                    }
                }
            }
        });
        
        const data = JSON.parse(response.text || '[]');
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
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Write an educational 3-sentence fun script for kids about ${topic} and 3 short image prompts. Return JSON {script, visualPrompts}.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        script: { type: Type.STRING },
                        visualPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['script', 'visualPrompts']
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { script: "Let's learn together!", visualPrompts: [topic] };
    }
};

// --- IMAGE GENERATION ---
export const generateImage = async (prompt: string, size: ImageSize, modelName: string = 'gemini-2.5-flash-image'): Promise<string | null> => {
  const cacheKey = `img-${prompt}-${size}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const res = `data:image/png;base64,${part.inlineData.data}`;
        setInCache(cacheKey, res);
        return res;
      }
    }
    return null;
  } catch (e) { return null; }
};

// --- SPEECH GENERATION ---
export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
    } catch (e) { return ''; }
}

export const getWavUrl = (base64Pcm: string): string => {
    if (!base64Pcm) return '';
    const binaryString = atob(base64Pcm);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/pcm' });
    return URL.createObjectURL(blob);
}

// --- UTILITIES & ACTIVITY LOGGING ---
export const logActivity = (type: string, details: string, category: string) => {
    console.log(`[WonderLog] ${category}: ${details} (${type})`);
};

export const getBuddyMessage = async (context: any, settings: any, isDirect: boolean = false) => {
    try {
        const ai = getAi();
        const prompt = isDirect 
            ? `As a friendly owl tutor, talk to a ${settings?.childAge || 5} year old child about: ${context}. Keep it under 2 sentences.`
            : `Provide a 1-sentence fun tip for a kid currently learning about ${context}.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        return response.text || "Hoot hoot! Let's keep exploring!";
    } catch (e) { return "Hoot! Having fun yet?"; }
};

// --- SEARCH & PARENT TOOLS ---
export const searchCurriculum = async (q: string): Promise<{ text: string, sources: GroundingChunk[] }> => { 
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: q,
            config: { tools: [{ googleSearch: {} }] }
        });
        return { 
            text: response.text || '', 
            sources: (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [] 
        }; 
    } catch (e) { return { text: "Couldn't search right now.", sources: [] }; }
}

export const generateParentInsights = async (logs: ActivityLog[], settings: ParentSettings) => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze these activity logs for ${settings.childName}: ${JSON.stringify(logs)}. Provide a helpful 3-sentence summary of their learning interests.`
        });
        return response.text || "No insights yet. Start learning to see progress!";
    } catch (e) { return "Insights are currently unavailable."; }
};

export const promptForKey = async () => { 
    if ((window as any).aistudio) await (window as any).aistudio.openSelectKey(); 
}

// --- LEGACY/STUB EXPORTS FOR COMPONENTS ---
export const generateLearnTopics = async (settings?: ParentSettings): Promise<LearnVideo[]> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate 4 educational video topics for a ${settings?.childAge || 5} year old. JSON [{id, title, description, category}].`,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '[]');
    } catch (e) { return []; }
}

export const generateFunFact = async (topic: string, settings?: ParentSettings) => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Write a 1-sentence funny kid fact about ${topic}. Age: ${settings?.childAge || 5}.`,
        });
        return response.text || "Learning is magic!";
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
