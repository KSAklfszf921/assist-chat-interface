import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[AUTH]', { timestamp: new Date().toISOString(), error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 20 requests per minute per user (atomic check)
    const rateLimitWindow = 60000; // 1 minute in ms
    const rateLimitMax = 20;
    const now = new Date();
    const windowStart = new Date(now.getTime() - rateLimitWindow);

    // Clean up old rate limit entries
    await supabase
      .from('rate_limits')
      .delete()
      .lt('window_start', windowStart.toISOString());

    // Use atomic function to check and increment rate limit
    const { data: isAllowed, error: rateLimitError } = await supabase
      .rpc('check_and_increment_rate_limit', {
        _user_id: user.id,
        _endpoint: 'openai-assistant',
        _window_start: windowStart.toISOString(),
        _max_requests: rateLimitMax
      });

    if (rateLimitError || !isAllowed) {
      console.error('[RATE_LIMIT]', { userId: user.id, timestamp: new Date().toISOString() });
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input schema
    const inputSchema = z.object({
      message: z.string().min(1, "Message cannot be empty").max(4000, "Message too long"),
      threadId: z.string().regex(/^thread_[a-zA-Z0-9]+$/, "Invalid thread format").nullish(),
    });

    const body = await req.json();
    const validationResult = inputSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('[VALIDATION]', { userId: user.id, timestamp: new Date().toISOString(), errorCount: validationResult.error.errors.length });
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, threadId } = validationResult.data;

    // Get user's active assistant from database
    const { data: assistantData, error: assistantError } = await supabase
      .from('user_assistants')
      .select('assistant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (assistantError || !assistantData) {
      console.error('[ASSISTANT_CONFIG]', { userId: user.id, timestamp: new Date().toISOString(), error: assistantError?.message });
      return new Response(
        JSON.stringify({ error: 'Service not configured. Please contact support.', code: 'ERR_ASSISTANT_NOT_CONFIGURED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistantId = assistantData.assistant_id;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      console.error('[SERVICE_CONFIG]', { userId: user.id, timestamp: new Date().toISOString(), issue: 'Missing API key' });
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable', code: 'ERR_SERVICE_CONFIG' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing authenticated request');

    // Create or use existing thread
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
      });

      if (!threadResponse.ok) {
        console.error('[THREAD_CREATE]', { userId: user.id, timestamp: new Date().toISOString(), status: threadResponse.status });
        return new Response(
          JSON.stringify({ error: 'Unable to start conversation', code: 'ERR_THREAD_CREATE' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const thread = await threadResponse.json();
      currentThreadId = thread.id;
      console.log('Thread created successfully');
    }

    // Add message to thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        role: 'user',
        content: message,
      }),
    });

    if (!messageResponse.ok) {
      console.error('[MESSAGE_SEND]', { userId: user.id, threadId: currentThreadId, timestamp: new Date().toISOString(), status: messageResponse.status });
      return new Response(
        JSON.stringify({ error: 'Unable to process message', code: 'ERR_MESSAGE_SEND' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message sent successfully');

    // Create run with streaming
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: assistantId,
        stream: true,
      }),
    });

    if (!runResponse.ok) {
      console.error('[ASSISTANT_RUN]', { userId: user.id, threadId: currentThreadId, timestamp: new Date().toISOString(), status: runResponse.status });
      return new Response(
        JSON.stringify({ error: 'Unable to generate response', code: 'ERR_ASSISTANT_RUN' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Response stream initiated');

    // Return the streaming response directly
    return new Response(runResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...(currentThreadId ? { 'X-Thread-Id': currentThreadId } : {}),
      },
    });

  } catch (error) {
    console.error('[FUNCTION_ERROR]', { timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : 'Unknown error' });
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', code: 'ERR_INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
