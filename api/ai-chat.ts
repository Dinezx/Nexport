import type { IncomingMessage } from 'http';
import type { ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  body?: any;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => VercelResponse;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const hfToken = process.env.HF_API_TOKEN;
  const hfModel = process.env.HF_MODEL;
  if (!hfToken || !hfModel) {
    return res.status(500).json({ error: 'HF_API_TOKEN or HF_MODEL not configured' });
  }
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }
    // Flatten chat messages into a single prompt string
    const prompt =
      messages
        .map((m: any) => {
          if (m.role === 'system') return `System: ${m.content}`;
          if (m.role === 'assistant') return `Assistant: ${m.content}`;
          return `User: ${m.content}`;
        })
        .join('\n') + '\nAssistant:';

    const hfRes = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.7,
        },
      }),
    });
    if (!hfRes.ok) {
      const errText = await hfRes.text();
      console.error('Hugging Face error:', hfRes.status, errText);
      return res.status(500).json({ error: 'HF API error', detail: errText });
    }
    const data = await hfRes.json();
    let reply = '';
    if (Array.isArray(data) && data.length > 0 && (data[0] as any).generated_text) {
      const full = String((data[0] as any).generated_text);
      reply = full.startsWith(prompt) ? full.slice(prompt.length).trim() : full.trim();
    } else if (data && typeof data === 'object' && (data as any).generated_text) {
      const full = String((data as any).generated_text);
      reply = full.startsWith(prompt) ? full.slice(prompt.length).trim() : full.trim();
    } else {
      reply = 'AI service returned an unexpected response';
    }
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('AI chat API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
