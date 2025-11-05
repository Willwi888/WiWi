import { GoogleGenAI, Type } from "@google/genai";
import { TimedLyric } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface ImageGenerationTask {
  prompt: string;
  startTime: number;
  endTime: number;
}

export async function generateVisualsForLyrics(
  timedLyrics: TimedLyric[], 
  songTitle: string, 
  artistName: string,
  onProgress: (progress: number, message: string) => void
): Promise<{ url: string; startTime: number; endTime: number }[]> {
  
  onProgress(0, '分析歌詞意境...');
  
  const lyricsToProcess = timedLyrics.filter(l => l.text && l.text.trim() !== '' && l.text !== 'END');
  if (lyricsToProcess.length === 0) return [];
  
  // 1. Group lyrics into stanzas (2 lines per stanza)
  const stanzas: { text: string; startTime: number; endTime: number }[] = [];
  for (let i = 0; i < lyricsToProcess.length; i += 2) {
    const chunk = lyricsToProcess.slice(i, i + 2);
    stanzas.push({
      text: chunk.map(l => l.text).join('\n'),
      startTime: chunk[0].startTime,
      endTime: chunk[chunk.length - 1].endTime,
    });
  }

  // 2. Generate image prompts for each stanza
  onProgress(10, '生成視覺化提示...');
  const promptGenerationSystemInstruction = `You are a creative director for music videos. Your task is to interpret song lyrics and generate a JSON array of visually striking, artistic image generation prompts in English. Each prompt should correspond to a lyrical stanza and capture its mood, theme, and key imagery. The prompts must be suitable for a generative AI image model like Imagen. Focus on creating beautiful and evocative scenes. Do not include any text in the prompts. Ensure the visual style is consistent across all prompts for a cohesive video. The song's overall theme is defined by its title and artist.`;
  
  const fullLyrics = lyricsToProcess.map(l => l.text).join('\n');
  const userPromptForPrompts = `
    Song Title: ${songTitle}
    Artist: ${artistName}
    Full Lyrics for context:
    ${fullLyrics}
    ---
    Now, generate an image prompt for each of the following stanzas. Return a JSON array of objects, where each object has a "stanza" key (the original text) and a "prompt" key (the generated English image prompt).
    Stanzas:
    ${JSON.stringify(stanzas.map(s => s.text))}
  `;

  const promptResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userPromptForPrompts,
    config: {
      systemInstruction: promptGenerationSystemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            stanza: { type: Type.STRING },
            prompt: { type: Type.STRING },
          }
        }
      }
    }
  });

  let generatedPrompts: {stanza: string; prompt: string}[];
  try {
    // FIX: Trim potential markdown code fences from the JSON response before parsing.
    const jsonText = promptResponse.text.replace(/^```json\n/, '').replace(/\n```$/, '');
    generatedPrompts = JSON.parse(jsonText);
  } catch (e) {
    console.error("Failed to parse prompts JSON:", promptResponse.text, e);
    throw new Error("AI failed to generate prompts in the correct format.");
  }
  
  const tasks: ImageGenerationTask[] = stanzas.map((stanza) => {
    const foundPrompt = generatedPrompts.find(p => p.stanza === stanza.text);
    return {
      prompt: foundPrompt ? foundPrompt.prompt : `A beautiful abstract visualization of the feeling of the song '${songTitle}'`,
      startTime: stanza.startTime,
      endTime: stanza.endTime,
    };
  });

  // 3. Generate images for each prompt
  const generatedImages: { url: string; startTime: number; endTime: number }[] = [];
  const totalImages = tasks.length;
  
  for (let i = 0; i < totalImages; i++) {
    const task = tasks[i];
    const progress = 20 + Math.round((i / totalImages) * 80);
    onProgress(progress, `正在生成第 ${i + 1} / ${totalImages} 張圖片...`);
    
    console.log(`Generating image for prompt: ${task.prompt}`);

    const imageResponse = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: task.prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
    });
    
    if (imageResponse.generatedImages.length > 0) {
      const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
      generatedImages.push({
        url: `data:image/jpeg;base64,${base64ImageBytes}`,
        startTime: task.startTime,
        endTime: task.endTime,
      });
    }
  }
  
  onProgress(100, '圖片生成完畢！');
  return generatedImages;
}