// src/llm/chatgpt.ts
export async function generateWithChatGPT(prompt: string, model = "gpt-4o-mini"): Promise<string> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || "No hubo respuesta.";
  } catch (err: any) {
    return `Error al generar (ChatGPT): ${err.message || err}`;
  }
}
