export async function generateWithOpenRouter(prompt: string, model: string): Promise<string> {
  try {
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
