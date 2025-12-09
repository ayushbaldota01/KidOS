

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ImageSize, LearnVideo, GeneratedVideo, ParentSettings, ActivityLog, Book, Story, View } from "../types";

// Helper to always get a fresh instance with the latest key
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to extract mime type
const getMimeType = (base64: string) => {
    const match = base64.match(/^data:(.*);base64,/);
    return match ? match[1] : 'image/png';
};

// 1. Fast Content Generation (Feed)
export const generateFunFact = async (topic: string, settings?: ParentSettings): Promise<string> => {
  try {
    const ai = getAi();
    // Personalize prompt if settings exist
    const ageContext = settings ? `for a ${settings.childAge}-year-old named ${settings.childName}` : 'for a 5-year-old';
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Write a very short, fun, and simple educational fact ${ageContext} about: ${topic}. Max 30 words. Keep it exciting!`,
    });
    return response.text || "Did you know learning is fun?";
  } catch (error) {
    console.error("Fast gen error:", error);
    return "Learning is super cool!";
  }
};

// 2. Complex Reasoning (Chatbot)
export const askProfessor = async (question: string): Promise<{ text: string, imageUrl?: string | null }> => {
  try {
    const ai = getAi();
    
    // Parallel execution: Text (Thinking) & Image Prompt (Flash)
    const textPromise = ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: question,
      config: {
        systemInstruction: "You are Professor Hoot, a wise and friendly owl teaching children. Answer the question in a very simple, visual, and storytelling way. Use simple words. Use Emojis 🌟. Focus on colors, shapes, and feelings. Keep it short (3-4 sentences).",
        thinkingConfig: { thinkingBudget: 2048 }
      },
    });

    const promptPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: `Create a simple, cute, colorful 3D render image prompt to explain this question to a 4 year old child: "${question}". Keep it under 20 words.`
    });

    // Wait for prompt, then generate image
    const imageGenerationPromise = promptPromise.then(async (res) => {
        const prompt = res.text || question;
        // Use Flash Image for speed in chat
        return generateImage(prompt, ImageSize.S_1K, 'gemini-2.5-flash-image');
    });

    const [textResponse, imageUrl] = await Promise.all([textPromise, imageGenerationPromise]);

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

// 4. Image Generation
export const generateImage = async (
    prompt: string, 
    size: ImageSize, 
    modelName: string = 'gemini-3-pro-image-preview'
): Promise<string | null> => {
  try {
    const ai = getAi();
    
    // Construct config dynamically based on model capabilities
    const imageConfig: any = {
        aspectRatio: "1:1"
    };

    // ONLY add imageSize for the Pro model. Flash Image DOES NOT support it.
    if (modelName === 'gemini-3-pro-image-preview') {
        imageConfig.imageSize = size;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: `A cute, child-friendly 3D render illustration of: ${prompt}. Bright colors, soft lighting, Pixar style.` }],
      },
      config: {
        imageConfig: imageConfig
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error: any) {
    console.error(`Image gen error (${modelName}):`, error);
    
    const errStr = error.toString();
    // Rethrow permission errors so UI can handle them
    if (errStr.includes('403') || errStr.includes('permission') || errStr.includes('API key')) {
        throw error;
    }

    // Fallback logic: If Pro fails (e.g. invalid param or other 400), try Flash
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
    console.error("Image edit error:", error);
    throw error;
  }
};

// 6. LearnTV: Topic Generation
export const generateLearnTopics = async (settings?: ParentSettings): Promise<LearnVideo[]> => {
  try {
    const ai = getAi();
    
    let prompt = "Generate 6 unique, highly engaging educational video topics for kids (3-7yo).";
    if (settings && settings.focusTopics.length > 0) {
        prompt += ` STRICTLY prioritize these interests: ${settings.focusTopics.join(', ')}.`;
        prompt += ` Adjust content for a ${settings.childAge} year old.`;
    }
    prompt += " Topics can also include: Space, Animals, How Things Work, Nature, Science. Ensure titles are short and catchy.";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING, description: "A catchy 2-sentence teaser." },
              category: { type: Type.STRING },
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '[]');
    return data.map((item: any, index: number) => ({
      ...item,
      id: `topic-${Date.now()}-${index}`
    }));
  } catch (error) {
    console.error("Topic gen error:", error);
    return [
      { id: '1', title: 'Why is the sky blue?', description: 'Discover the colors of the sky!', category: 'Science' },
    ];
  }
};

// 6b. LearnTV: Related Topics
export const generateRelatedTopics = async (currentTopic: string): Promise<LearnVideo[]> => {
    try {
      const ai = getAi();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate 3 unique, engaging educational video topics for kids (3-7yo) that are related to: "${currentTopic}".`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
              }
            }
          }
        }
      });
  
      const data = JSON.parse(response.text || '[]');
      return data.map((item: any, index: number) => ({
        ...item,
        id: `related-${Date.now()}-${index}`
      }));
    } catch (error) {
      return [];
    }
  };

// 7. LearnTV: Lesson Script + Visuals (Slideshow Logic)
export const generateLessonScript = async (topic: string): Promise<{ script: string, visualPrompts: string[] }> => {
  try {
    const ai = getAi();
    // Return structured JSON with script AND visual prompts for slideshow
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Create a captivating educational content package for a 5-year-old about "${topic}".
      
      Requirements:
      1. 'script': A spoken-word script (approx 250-300 words). Warm, energetic narrator. NO stage directions.
      2. 'visualPrompts': An array of EXACTLY 5 distinct, simple image descriptions that illustrate the story progression (Start, Middle, End).`,
      config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.OBJECT,
              properties: {
                  script: { type: Type.STRING },
                  visualPrompts: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING } 
                  }
              }
          },
          thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    
    const data = JSON.parse(response.text || '{}');
    let script = data.script || `Today we learn about ${topic}`;
    // Cleanup script just in case
    script = script.replace(/\[.*?\]/g, '').replace(/\*.*?\*/g, '').replace(/\(.*?\)/g, '');
    
    return {
        script: script,
        visualPrompts: data.visualPrompts || [`Illustration of ${topic}`]
    };
  } catch (error) {
    console.error("Script gen error", error);
    return {
        script: `Welcome! Today let's explore ${topic}. It is going to be amazing.`,
        visualPrompts: [`${topic} illustration`]
    };
  }
};

// 8. TTS Generation
export const generateSpeech = async (text: string): Promise<Uint8Array> => {
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
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio generated");
        return decode(base64Audio);
    } catch (error) {
        console.error("TTS error:", error);
        throw error;
    }
}

// 9. Veo Video Generation
export const generateVeoVideo = async (prompt: string, imageBase64?: string): Promise<any> => {
    try {
        const ai = getAi();
        const videoPrompt = `A high quality, cinematic video suitable for children: ${prompt}`;

        if (imageBase64) {
            const mimeType = getMimeType(imageBase64);
            const base64Data = imageBase64.split(',')[1] || imageBase64;
            return await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: videoPrompt,
                image: { imageBytes: base64Data, mimeType: mimeType },
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
            });
        } else {
            return await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: videoPrompt,
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
            });
        }
    } catch (error) {
        console.error("Veo init error:", error);
        throw error;
    }
}

export const pollForVideo = async (operation: any): Promise<GeneratedVideo | null> => {
    let currentOp = operation;
    const ai = getAi();
    const maxAttempts = 60; 
    let attempts = 0;

    while (!currentOp.done && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
            currentOp = await ai.operations.getVideosOperation({ operation: currentOp });
            attempts++;
        } catch (e) { console.warn("Polling retry", e); }
    }
    
    const uri = currentOp.response?.generatedVideos?.[0]?.video?.uri;
    if (uri) {
        return {
            uri: `${uri}&key=${process.env.API_KEY}`,
            mimeType: 'video/mp4'
        };
    }
    return null;
}

// 10. Parent Insights Generation
export const generateParentInsights = async (logs: ActivityLog[], settings: ParentSettings): Promise<string> => {
    try {
        const ai = getAi();
        const logSummary = logs.map(l => `${l.category}: ${l.details}`).join('\n');
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this activity log for a ${settings.childAge}-year-old named ${settings.childName}.
            Logs:
            ${logSummary}
            
            Provide a encouraging summary for the parent. Mention:
            1. What topics the child loves most.
            2. How they are developing (curiosity, creativity).
            3. A suggestion for what to encourage next.
            Keep it under 100 words. Be warm and professional.`,
        });
        return response.text || "Your child is exploring new topics every day!";
    } catch (e) {
        return "Not enough data yet for a full analysis, but your child is doing great!";
    }
}

// 11. Library Generation
export const generateLibrary = async (settings?: ParentSettings): Promise<Book[]> => {
    try {
        const ai = getAi();
        let prompt = "Generate 6 captivating, short story book titles for a child (3-7yo).";
        if (settings) {
            prompt += ` Incorporate interests: ${settings.focusTopics.join(', ')}.`;
        }
        prompt += ` For each book provide:
        - title
        - emoji (representing the book)
        - color (a tailwind CSS color class like 'bg-red-500', 'bg-blue-400')
        - description (super short 1 sentence)
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            emoji: { type: Type.STRING },
                            color: { type: Type.STRING },
                            description: { type: Type.STRING },
                        }
                    }
                }
            }
        });
        const data = JSON.parse(response.text || '[]');
        return data.map((b: any, i: number) => ({ ...b, id: `book-${i}` }));
    } catch (e) {
        return [{ id: '1', title: 'The Magic Star', emoji: '⭐', color: 'bg-yellow-400', description: 'A star that wanted to dance.' }];
    }
}

// 12. Story Generation
export const generateStory = async (title: string): Promise<Story> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a captivating children's story for a 4-5 year old titled "${title}".
            Length: Exactly 6 pages.
            
            Tone: Playful, rhythmic, simple words.
            Features: 
            - Use sound words (e.g. "Whoosh!", "Pop!", "Tip-tap").
            - Include 1 interactive question for the child (e.g. "Can you spot the blue bird?").
            
            Structure:
            1. 'coverPrompt': Cute, colorful 3D render book cover description.
            2. 'pages': Array of 6 pages.
               - 'text': Story text (approx 40-50 words per page). Use dialogue.
               - 'imagePrompt': Highly recommended for EVERY page to keep engagement, but at least for pages 1, 3, 5.
            `,
            config: {
                responseMimeType: "application/json",
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
                                    imagePrompt: { type: Type.STRING, nullable: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error("Story gen error", e);
        // Fallback story
        return {
            title: title,
            coverPrompt: `Book cover about ${title}`,
            pages: [
                { text: `Once upon a time, deep in a magical land, there was a story about ${title}. The sun was setting over the hills. Whoosh went the wind!`, imagePrompt: `Magical land about ${title}` },
                { text: "It was a beautiful day. 'Hello!' said the little bunny. Can you wave hello too?", imagePrompt: "Cute bunny waving" },
                { text: "Suddenly, a friendly breeze swept through the trees. Rustle, rustle. The leaves danced.", imagePrompt: "Trees dancing in wind" },
                { text: "Everyone learned something new. Do you like learning new things?", imagePrompt: "Happy animals learning" },
                { text: "As the stars appeared, they had a feast. Yummy! Crunch, munch.", imagePrompt: "Feast under moonlight" },
                { text: "And they all lived happily ever after. The End.", imagePrompt: null }
            ]
        };
    }
}

// 13. Floating Buddy Helper (Modified for Voice Interaction)
export const getBuddyMessage = async (context: string, settings: ParentSettings | null, isVoiceQuery: boolean = false): Promise<string> => {
    try {
        const ai = getAi();
        const name = settings?.childName || "Friend";
        
        // If it's a direct voice question, treat it like a conversation
        const prompt = isVoiceQuery 
            ? `You are Hoot, a friendly owl driving a flying car. 
               The child (named ${name}) asked you: "${context}". 
               Answer in 1 sentence. Be encouraging and fun.`
            : `You are Hoot, a friendly owl driving a flying car. 
               The child is currently looking at: "${context}".
               Give a very short, super encouraging, 1-sentence tip or fun comment using the name "${name}".`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: prompt
        });
        return response.text || `Hoot hoot! Doing great, ${name}!`;
    } catch (e) {
        return "You're doing great!";
    }
}

// 14. Activity Logger
export const logActivity = (type: ActivityLog['type'], details: string, category: string) => {
    const log: ActivityLog = {
        id: Date.now().toString(),
        type,
        details,
        timestamp: Date.now(),
        category
    };
    
    // Save to local storage for parent zone
    const existing = localStorage.getItem('activity_logs');
    const logs: ActivityLog[] = existing ? JSON.parse(existing) : [];
    logs.unshift(log);
    // Keep last 50
    if (logs.length > 50) logs.pop();
    localStorage.setItem('activity_logs', JSON.stringify(logs));
}

// 15. Chess Coach
export const getChessAdvice = async (fen: string): Promise<string> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a chess coach for a 7-year-old. 
            The current board state (simplified representation) is: 
            ${fen}
            
            Suggest ONE simple, good move for White. Explain WHY in 1 very short, simple sentence. 
            Don't use complex notation. Say things like "Move the knight to protect the king!"`
        });
        return response.text || "Try moving your pawns forward to control the center!";
    } catch (e) {
        return "Think about controlling the center of the board!";
    }
}

// 16. Language Learning
export const generateLanguageLesson = async (language: string, difficulty: 'Easy' | 'Medium'): Promise<any> => {
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a single language learning card for a child learning ${language} (${difficulty} level).
            Return JSON with:
            - phrase (in ${language})
            - translation (in English)
            - pronunciation (phonetic guide)
            - imagePrompt (cute visual description)
            - voiceInstruction (what the AI assistant should say to the child, e.g. "Can you say 'Hola'?")
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        phrase: { type: Type.STRING },
                        translation: { type: Type.STRING },
                        pronunciation: { type: Type.STRING },
                        imagePrompt: { type: Type.STRING },
                        voiceInstruction: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        console.error(e);
        return { phrase: 'Hola', translation: 'Hello', pronunciation: 'oh-la', imagePrompt: 'Waving hand', voiceInstruction: 'Say Hola!' };
    }
}

export const checkPronunciation = async (target: string, spoken: string): Promise<any> => {
     try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `The child was asked to say "${target}". They said "${spoken}".
            Is this close enough? Return JSON:
            - correct (boolean)
            - feedback (short, encouraging sentence for a 5 year old)
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        correct: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{}');
     } catch (e) {
         return { correct: true, feedback: "Good try!" };
     }
}

// --- Helpers ---

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createWavHeader(dataLength: number, sampleRate: number): Uint8Array {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    return new Uint8Array(buffer);
}
  
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export const getWavUrl = (pcmData: Uint8Array, sampleRate: number = 24000): string => {
    const header = createWavHeader(pcmData.length, sampleRate);
    const wavBlob = new Blob([header, pcmData], { type: 'audio/wav' });
    return URL.createObjectURL(wavBlob);
};

export const hasApiKey = async (): Promise<boolean> => {
    try {
        const win = window as any;
        if (win.aistudio && win.aistudio.hasSelectedApiKey) {
            return await win.aistudio.hasSelectedApiKey();
        }
        return false;
    } catch(e) { return false; }
}

export const promptForKey = async (): Promise<void> => {
    const win = window as any;
    if (win.aistudio && win.aistudio.openSelectKey) {
        await win.aistudio.openSelectKey();
    }
}
