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
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data: any = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No hubo respuesta.";
  } catch (err: any) {
    return `Error al generar: ${err.message || err}`;
  }
}
