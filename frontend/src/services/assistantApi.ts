export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  evidence?: string[];
  map_action?: { type: string; cell_id: string; lat: number; lon: number } | null;
}

export interface ChatResponse {
  answer: string;
  evidence: string[];
  map_action: any;
  confidence_note: string | null;
}

export async function sendChatMessage(
  message: string,
  analysisId?: string,
  cellId?: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      analysis_id: analysisId || null,
      cell_id: cellId || null,
      conversation_history: conversationHistory.map(m => ({ role: m.role, content: m.content }))
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
