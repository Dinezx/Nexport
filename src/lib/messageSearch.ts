import { createClient } from '@supabase/supabase-js';

/**
 * Search messages in a conversation with full-text search
 */
export async function searchMessages(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  query: string,
  limit: number = 20
) {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Use PostgreSQL full-text search
    const { data, error } = await (supabase as any)
      .from('message_search')
      .select(
        `
        id,
        message_id,
        messages (
          id,
          conversation_id,
          sender_id,
          sender_role,
          content,
          created_at
        )
      `
      )
      .eq('conversation_id', conversationId)
      .textSearch('content_tsv', query, { type: 'websearch' })
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching messages:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Message search failed:', err);
    return [];
  }
}

/**
 * Search messages across all conversations user has access to
 */
export async function globalMessageSearch(
  supabase: ReturnType<typeof createClient>,
  query: string,
  limit: number = 50
) {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Get all conversations user has access to
    const { data: conversations, error: convError } = await (supabase as any)
      .from('conversations')
      .select('id');

    if (convError || !conversations) {
      console.error('Error fetching conversations:', convError);
      return [];
    }

    const conversationIds = conversations.map((c: any) => c.id);

    // Search across all user's conversations
    const { data, error } = await (supabase as any)
      .from('message_search')
      .select(
        `
        id,
        conversation_id,
        messages (
          id,
          conversation_id,
          sender_id,
          sender_role,
          content,
          created_at
        )
      `
      )
      .in('conversation_id', conversationIds)
      .textSearch('content_tsv', query, { type: 'websearch' })
      .limit(limit)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in global search:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Global message search failed:', err);
    return [];
  }
}

/**
 * Get trending topics/keywords in conversations
 */
export async function getTrendingKeywords(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  limit: number = 10
) {
  try {
    // This is a simplified approach - in production you'd want more sophisticated NLP
    const { data: messages, error } = await (supabase as any)
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !messages) {
      return [];
    }

    // Simple keyword extraction (words longer than 4 chars, non-common words)
    const keywords = new Map<string, number>();
    const commonWords = new Set([
      'the',
      'and',
      'that',
      'this',
      'with',
      'have',
      'from',
      'can',
      'will',
      'are',
      'been',
      'have',
      'their',
      'would',
      'could',
      'about',
      'which',
      'your',
      'need',
      'shipping',
      'please',
    ]);

    messages.forEach((msg: any) => {
      const words = msg.content.toLowerCase().split(/\W+/);
      words.forEach((word) => {
        if (word.length > 4 && !commonWords.has(word)) {
          keywords.set(word, (keywords.get(word) || 0) + 1);
        }
      });
    });

    return Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  } catch (err) {
    console.error('Failed to extract trending keywords:', err);
    return [];
  }
}

/**
 * Highlight search results in text
 */
export function highlightSearchResults(text: string, query: string): string {
  if (!query || query.length < 2) return text;

  const regex = new RegExp(`(${query.split(/\s+/).join('|')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Extract context around search term
 */
export function extractContextSnippet(text: string, query: string, contextLength: number = 100): string {
  if (!query || query.length < 2) {
    return text.slice(0, contextLength + 50);
  }

  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) {
    return text.slice(0, contextLength + 50);
  }

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + query.length + contextLength);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet += '...';

  return snippet;
}
