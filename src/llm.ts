export async function generateWithGemini(prompt: string): Promise<string> {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No hubo respuesta."
    );
  } catch (err: any) {
    return `Error al generar: ${err.message || err}`;
  }
}

export async function generateWithDeepSeek(prompt: string): Promise<string> {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ""}`,
          "HTTP-Referer": "http://localhost",
          "X-Title": "UnityTestIA",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3.1:free",
          messages: [
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    return (
      data.choices?.[0]?.message?.content ||
      "No hubo respuesta."
    );
  } catch (err: any) {
    return `Error al generar: ${err.message || err}`;
  }
}

export async function generateWithChatGPT(prompt: string): Promise<string> {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CHATGPT_API_KEY || ""}`,
          "HTTP-Referer": "http://localhost", 
          "X-Title": "UnityTestIA", 
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b:free",
          messages: [
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    return (
      data.choices?.[0]?.message?.content ||
      "No hubo respuesta."
    );
  } catch (err: any) {
    return `Error al generar: ${err.message || err}`;
  }
}


