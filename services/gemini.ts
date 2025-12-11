
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ImageSize, LearnVideo, GeneratedVideo, ParentSettings, ActivityLog, Book, Story, View } from "../types";

// Helper to always get a fresh instance with the latest key
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Simple in-memory cache
const memoryCache = new Map<string, any>();

const getFromCache = (key: string) => memoryCache.get(key);
const setInCache = (key: string, value: any) => {
    if (memoryCache.size > 50) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey) memoryCache.delete(firstKey);
    }
    memoryCache.set(key, value);
};

// Helper to extract mime type
const getMimeType = (base64: string) => {
    const match = base64.match(/^data:(.*);base64,/);
    return match ? match[1] : 'image/png';
};

interface IBLMParams {
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
    category?: 'STANDARD' | 'HIGH_ENERGY' | 'CALM';
}

// 1. Fast Content Generation (Feed) - ADAPTED FOR IBLM
export const generateFunFact = async (
    topic: string, 
    settings?: ParentSettings,
    iblmParams?: IBLMParams
): Promise<string> => {
  // We incorporate IBLM params into the cache key so different states get different content
  const cacheKey = `fact-${topic}-${settings?.childAge || 'def'}-${iblmParams?.difficulty || 'med'}-${iblmParams?.category || 'std'}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const ai = getAi();
    const ageContext = settings ? `for a ${settings.childAge}-year-old named ${settings.childName}` : 'for a 5-year-old';
    
    // IBLM Logic Injection
    let styleInstruction = "Write a very short, fun, and simple educational fact.";
    if (iblmParams?.difficulty === 'EASY') {
        styleInstruction = "Write an extremely simple, 1-sentence fact. Use very basic words. Make it sound like a joke.";
    } else if (iblmParams?.difficulty === 'HARD') {
        styleInstruction = "Write a fascinating, slightly complex fact with a scientific detail. 2 sentences.";
    }

    let topicModifier = "";
    if (iblmParams?.category === 'HIGH_ENERGY') {
        topicModifier = "Make it sound EXCITING and EXPLOSIVE! Use exclamation marks!";
    } else if (iblmParams?.category === 'CALM') {
        topicModifier = "Make it sound soothing and gentle.";
    }

    // Use Flash Lite for speed
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `${styleInstruction} ${topicModifier} ${ageContext} about: ${topic}. Max 30 words.`,
    });
    const text = response.text || "Did you know learning is fun?";
    setInCache(cacheKey, text);
    return text;
  } catch (error) {
    console.error("Fast gen error:", error);
    return "Learning is super cool!";
  }
};

// 2. Complex Reasoning (Chatbot) - OPTIMIZED FOR SPEED
export const askProfessor = async (question: string): Promise<{ text: string, imageUrl?: string | null }> => {
  try {
    const ai = getAi();
    
    // Optimization: Run Text and Image generation in PARALLEL.
    
    const textPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: question,
      config: {
        systemInstruction: "You are Professor Hoot, a wise and friendly owl teaching children. Answer the question in a very simple, visual, and storytelling way. Use simple words. Use Emojis 🌟. Focus on colors, shapes, and feelings. Keep it short (3-4 sentences).",
      },
    });

    // Use Flash Image directly with the user question + style modifier
    const imagePromise = generateImage(
        `Cute, colorful 3D render illustration explaining: ${question}. Bright colors, soft lighting, Pixar style.`, 
        ImageSize.S_1K, 
        'gemini-2.5-flash-image'
    );

    const [textResponse, imageUrl] = await Promise.all([textPromise, imagePromise]);

    return {
        text: textResponse.text || "Hoot hoot! I'm thinking...",
        imageUrl: imageUrl
    };

  } catch (error) {
    console.error("Professor error:", error);
    return { text: "My feathers are ruffled! I couldn't think of an answer." };
  }
};

// 3. Search Grounding
export const searchCurriculum = async (query: string) => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
};

// 4. Image Generation - CACHED
export const generateImage = async (
    prompt: string, 
    size: ImageSize, 
    modelName: string = 'gemini-2.5-flash-image' // Default to fast model
): Promise<string | null> => {
  const cacheKey = `img-${modelName}-${prompt}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const ai = getAi();
    
    const imageConfig: any = {
        aspectRatio: "1:1"
    };

    // Only set imageSize for Pro models, Flash Image doesn't support it in the same way or defaults effectively.
    if (modelName === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = size;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: imageConfig
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const res = `data:image/png;base64,${part.inlineData.data}`;
        setInCache(cacheKey, res);
        return res;
      }
    }
    return null;
  } catch (error: any) {
    console.error(`Image gen error (${modelName}):`, error);
    
    const errStr = error.toString();
    if (errStr.includes('403') || errStr.includes('permission') || errStr.includes('API key')) {
        throw error;
    }

    if (modelName === 'gemini-3-pro-image-preview') {
        console.log("Falling back to Flash Image...");
        return generateImage(prompt, size, 'gemini-2.5-flash-image');
    }
    throw error;
  }
};

// 4b. Identify Drawing (Multimodal)
export const identifyDrawing = async (base64Image: string): Promise<string> => {
    try {
        const ai = getAi();
        const mimeType = getMimeType(base64Image);
        const base64Data = base64Image.split(',')[1] || base64Image;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: "What is this a drawing of? Answer in 1 short, cheerful sentence to a 5-year-old child. Be encouraging! Start with 'Is that a...' or 'Wow, it looks like a...'" }
                ]
            }
        });

        return response.text || "Wow, what a beautiful drawing!";
    } catch (error) {
        console.error("Identify drawing error:", error);
        return "That looks amazing! Keep drawing!";
    }
};

// 5. Image Editing
export const editImage = async (base64Image: string, instruction: string): Promise<string | null> => {
    try {
        const ai = getAi();
        const mimeType = getMimeType(base64Image);
        const base64Data = base64Image.split(',')[1] || base64Image;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: instruction }
                ]
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Edit image error:", error);
        return null;
    }
};

// 6. Generate Library
export const generateLibrary = async (settings?: ParentSettings): Promise<Book[]> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Generate a list of 6 children's book titles with emoji, color (tailwind class like bg-red-500), and short description.",
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            title: { type: Type.STRING },
                            emoji: { type: Type.STRING },
                            color: { type: Type.STRING },
                            description: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        const text = response.text;
        if (text) return JSON.parse(text);
        return [];
    } catch (e) {
        return [];
    }
}

// 7. Generate Story
export const generateStory = async (title: string): Promise<Story> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a short story for children titled "${title}". 5 pages.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        coverPrompt: { type: Type.STRING },
                        pages: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    imagePrompt: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        const text = response.text;
        if (text) return JSON.parse(text);
        throw new Error("No story generated");
    } catch (e) {
        throw e;
    }
}

// 8. Prompt For Key (For Veo/Pro models)
export const promptForKey = async () => {
    if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
    }
}

// 9. Chess Advice
export const getChessAdvice = async (boardState: string): Promise<string> => {
     try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a chess coach for kids. Here is the board:\n${boardState}\nGive a hint for the white player. Keep it simple and encouraging. Max 2 sentences.`
        });
        return response.text || "Move your knights to the center!";
     } catch(e) { return "Think about controlling the center!"; }
}

// 10. Language Lesson
export const generateLanguageLesson = async (language: string, difficulty: string): Promise<any> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a simple word or phrase to learn in ${language} (${difficulty}).`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        phrase: { type: Type.STRING },
                        pronunciation: { type: Type.STRING },
                        translation: { type: Type.STRING },
                        voiceInstruction: { type: Type.STRING },
                        imagePrompt: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch(e) { return null; }
}

// 11. Check Pronunciation
export const checkPronunciation = async (target: string, input: string): Promise<{correct: boolean, feedback: string}> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Target phrase: "${target}". User said: "${input}". Is it close enough? Return JSON.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        correct: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{"correct": false, "feedback": "Try again!"}');
    } catch(e) { return {correct: false, feedback: "Error checking."}; }
}

// 12. Parent Insights
export const generateParentInsights = async (logs: ActivityLog[], settings: ParentSettings): Promise<string> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze these activity logs for child ${settings.childName} (age ${settings.childAge}): ${JSON.stringify(logs)}. Provide a short encouraging weekly summary for the parent.`
        });
        return response.text || "Your child is doing great!";
    } catch(e) { return "Insights unavailable."; }
}

// 13. Learn Topics
export const generateLearnTopics = async (settings?: ParentSettings): Promise<LearnVideo[]> => {
     try {
        const ai = getAi();
        const age = settings?.childAge || 5;
        // Default topics if none provided
        const defaultTopics = "Science, Nature, Space, Kindness, Friendship";
        const topicContext = settings?.focusTopics?.length 
            ? `topics related to: ${settings.focusTopics.join(", ")}` 
            : `general educational topics like ${defaultTopics}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate 4 engaging and age-appropriate video topics for a ${age}-year-old child. Focus on ${topicContext}. Make titles fun and catchy.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            category: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        const videos = JSON.parse(response.text || '[]');
        return videos.map((v: any, i: number) => ({...v, id: `gen-${Date.now()}-${i}`}));
    } catch(e) { return []; }
}

// 14. Related Topics
export const generateRelatedTopics = async (topic: string): Promise<LearnVideo[]> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate 3 related video topics for kids similar to: ${topic}.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            category: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        const videos = JSON.parse(response.text || '[]');
        return videos.map((v: any, i: number) => ({...v, id: `rel-${Date.now()}-${i}`}));
    } catch(e) { return []; }
}

// 15. Lesson Script
export const generateLessonScript = async (topic: string): Promise<{script: string, visualPrompts: string[]}> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Create a short educational script (max 100 words) about "${topic}" for a 5-year-old. Also provide 3 visual prompts for images to accompany the script.`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        script: { type: Type.STRING },
                        visualPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch(e) { return { script: "Learning is fun!", visualPrompts: [] }; }
}

// 16. Speech Generation
export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }
                    }
                }
            }
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
    } catch(e) {
        console.error("TTS Error", e);
        return '';
    }
}

// 17. WAV URL Helper
export const getWavUrl = (base64Pcm: string): string => {
    if (!base64Pcm) return '';
    try {
        const binaryString = atob(base64Pcm);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // WAV Header for 24kHz Mono 16-bit
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        const numChannels = 1;
        const sampleRate = 24000;
        const bitsPerSample = 16;
        const subChunk2Size = len;
        const chunkSize = 36 + subChunk2Size;
        const byteRate = sampleRate * numChannels * bitsPerSample / 8;
        const blockAlign = numChannels * bitsPerSample / 8;

        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, chunkSize, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(view, 36, 'data');
        view.setUint32(40, subChunk2Size, true);

        const blob = new Blob([view, bytes], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error("WAV conversion error", e);
        return '';
    }
}

// 18. Buddy Message
export const getBuddyMessage = async (context: string | View, settings: ParentSettings | null, isVoice: boolean = false): Promise<string> => {
     try {
        const ai = getAi();
        const prompt = isVoice 
            ? `Child asks: "${context}". Answer briefly and kindly as a wise owl friend.`
            : `User is on screen: ${context}. Give a 1-sentence helpful tip or fun fact for a child named ${settings?.childName || 'friend'}.`;
            
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "Hoot hoot!";
    } catch(e) { return "I'm here to help!"; }
}

// 19. Log Activity
export const logActivity = (type: string, details: string, category: string) => {
    console.log(`[ACTIVITY] ${type}: ${details} (${category})`);
}
