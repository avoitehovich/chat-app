import axios, { AxiosError } from "axios"; // Import AxiosError
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { topic } = await req.json();
  try {
    const res = await axios.post(
      "https://api.edenai.run/v2/text/chat",
      {
        providers: "openai",
        text: `Tell me the most relevant content about ${topic} in Markdown format`,
        chatbot_global_action: "Act as a helpful assistant",
        temperature: 0.7,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: process.env.NEXT_PUBLIC_EDEN_AI_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    const aiResponse = res.data.openai.generated_text;
    const responseWithSources = `${aiResponse}\n\n**Sources**:\n- [Example Source 1](https://example.com/${topic}-1)\n- [Example Source 2](https://example.com/${topic}-2)`;
    return new Response(JSON.stringify(responseWithSources), { status: 200 });
  } catch (error) {
    const axiosError = error as AxiosError; // Type the error
    return new Response(
      JSON.stringify({ error: axiosError.message }),
      { status: axiosError.response?.status || 500 }
    );
  }
}