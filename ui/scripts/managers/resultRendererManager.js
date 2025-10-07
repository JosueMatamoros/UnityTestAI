export function renderResult(raw, resultContainer, copyBtn) {
  const regex = /```csharp([\s\S]*?)```/gi;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: raw.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", content: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < raw.length) {
    segments.push({ type: "text", content: raw.slice(lastIndex) });
  }

  let html = "";
  segments.forEach((seg) => {
    if (seg.type === "code") {
      html += `
        <div class="code-block">
          <pre><code class="language-cs">${seg.content
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</code></pre>
        </div>`;
    } else {
      const text = seg.content.trim();
      if (text) {
        html += `<div class="text-block">${text
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</div>`;
      }
    }
  });

  resultContainer.innerHTML = html;
  hljs.highlightAll();

  const codeOnly = segments.filter(s => s.type === "code").map(s => s.content).join("\n\n");

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(codeOnly);
    copyBtn.textContent = "Copiado!";
    setTimeout(() => (copyBtn.textContent = "Copiar"), 2000);
  };
}
