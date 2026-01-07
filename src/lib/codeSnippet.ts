function escapeForQuery(value: string): string {
  return encodeURIComponent(value);
}

export const getCodeSnippet = (
  language: string,
  { input, voice }: { input: string; voice: string },
): string => {
  const baseUrl = "http://localhost:3000";
  const query = `input=${escapeForQuery(input)}` + `&voice=${escapeForQuery(voice)}` + `&format=mp3`;

  switch (language) {
    case "py":
      return `import requests

url = "${baseUrl}/api/generate?${query}"
res = requests.get(url)
res.raise_for_status()

with open("speech.mp3", "wb") as f:
    f.write(res.content)
`;
    case "js":
      return `const url = "${baseUrl}/api/generate?${query}";

const res = await fetch(url);
if (!res.ok) throw new Error(await res.text());

const blob = await res.blob();
const audioUrl = URL.createObjectURL(blob);

const audio = new Audio(audioUrl);
audio.play();
`;
    case "curl":
      return `curl "${baseUrl}/api/generate?${query}" --output speech.mp3`;
    default:
      return "";
  }
};
