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

export async function generateWithOpenRouter(prompt: string, model: string): Promise<string> {
  try {
    console.log("Payload que voy a enviar:", {
      model,
      messages: [{ role: "user", content: prompt }],
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "HTTP-Referer": "http://localhost",
        "X-Title": "UnityTestIA",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || "No hubo respuesta.";
  } catch (err: any) {
    return `Error al generar: ${err.message || err}`;
  }
}
