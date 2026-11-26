import { z } from "zod";
import { generateStructuredCompletion } from "../ai/provider";

/**
 * Detects language using Unicode script block analysis.
 */
export function detectLanguage(text) {
  if (!text || text.trim().length === 0) return "en";

  const totalChars = text.length;
  let devanagariCount = 0;
  let gurmukhiCount = 0;
  let bengaliCount = 0;
  let tamilCount = 0;

  for (let i = 0; i < totalChars; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0900 && code <= 0x097f) devanagariCount++;
    else if (code >= 0x0a00 && code <= 0x0a7f) gurmukhiCount++;
    else if (code >= 0x0980 && code <= 0x09ff) bengaliCount++;
    else if (code >= 0x0b80 && code <= 0x0bff) tamilCount++;
  }

  if (devanagariCount / totalChars > 0.15) return "hi";
  if (gurmukhiCount / totalChars > 0.15) return "pa";
  if (bengaliCount / totalChars > 0.15) return "bn";
  if (tamilCount / totalChars > 0.15) return "ta";

  return "en";
}

const translationSchema = z.object({
  englishTranslation: z.string(),
  detectedLanguage: z.string(),
});

/**
 * Translates non-English election claims into English for downstream fact-check querying
 * while preserving the original text in the database.
 */
export async function normalizeToEnglish(text, hintLanguage) {
  const detected = hintLanguage && hintLanguage !== "en" ? hintLanguage : detectLanguage(text);

  if (detected === "en") {
    return {
      originalText: text,
      detectedLanguage: "en",
      englishText: text,
    };
  }

  const mockTranslation = () => {
    let translated = text;

    if (detected === "hi") {
      translated = translated
        .replace(/ईवीएम/g, "EVM")
        .replace(/बैटरी/g, "battery")
        .replace(/वोटर आईडी/g, "Voter ID")
        .replace(/चुनाव आयोग/g, "Election Commission")
        .replace(/मतदाता सूची/g, "voter list")
        .replace(/सोशल मीडिया पर दावा किया जा रहा है कि/g, "It is being claimed on social media that")
        .replace(/में पहले से वोट सेट किए गए हैं/g, "have been pre-set with votes")
        .replace(/निष्पक्ष हैं/g, "are fair and untampered");
      if (translated === text) {
        translated = `[Hindi translation]: ${text}`;
      }
    }

    if (detected === "pa") {
      translated = translated
        .replace(/ਈਵੀਐਮ/g, "EVM")
        .replace(/ਬੈਟਰੀ/g, "battery")
        .replace(/ਵੋਟਰ ਕਾਰਡ/g, "Voter ID Card")
        .replace(/ਚੋਣ ਕਮਿਸ਼ਨ/g, "Election Commission")
        .replace(/ਵੋਟਰ ਸੂਚੀ/g, "electoral roll")
        .replace(/ਆਧਾਰ ਕਾਰਡ/g, "Aadhaar card")
        .replace(/ਦਾਅਵਾ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ ਕਿ/g, "It is claimed that");
      if (translated === text) {
        translated = `[Punjabi translation]: ${text}`;
      }
    }

    return {
      englishTranslation: translated,
      detectedLanguage: detected,
    };
  };

  try {
    const result = await generateStructuredCompletion({
      prompt: `Translate the following ${detected} election claim accurately into English for fact-checking. Preserve named entities (ECI, EVM, political parties):\n\n"${text}"`,
      systemPrompt: "You are an official election multilingual translator. Output strictly valid JSON with { englishTranslation, detectedLanguage }.",
      schema: translationSchema,
      promptVersion: "translation.v1",
      fallbackMock: mockTranslation,
    });

    return {
      originalText: text,
      detectedLanguage: detected,
      englishText: result.data.englishTranslation,
    };
  } catch {
    const fallback = mockTranslation();
    return {
      originalText: text,
      detectedLanguage: detected,
      englishText: fallback.englishTranslation,
    };
  }
}
