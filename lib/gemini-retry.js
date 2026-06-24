// Retry wrapper for Gemini API calls
// Handles 503 "model overloaded" errors by retrying with exponential backoff
export async function generateWithRetry(model, prompt, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result;
    } catch (error) {
      lastError = error;
      const is503 = error?.status === 503 || error?.message?.includes("503") || error?.message?.includes("overloaded");

      if (is503 && attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Gemini 503 on attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}
