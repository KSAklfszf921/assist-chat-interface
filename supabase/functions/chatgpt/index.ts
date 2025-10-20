import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ERROR_CODES = {
  NO_API_KEY: "ERR_NO_OPENAI_KEY",
  INVALID_INPUT: "ERR_INVALID_INPUT",
  RATE_LIMIT_EXCEEDED: "ERR_RATE_LIMIT",
  OPENAI_API_ERROR: "ERR_OPENAI_API",
} as const;

const inputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1, "Message cannot be empty").max(4000, "Message too long"),
  })).min(1, "At least one message required").max(50, "Too many messages in conversation"),
  conversationId: z.string().uuid("Invalid conversation ID format"),
  model: z.enum([
    'gpt-5-nano-2025-08-07',
    'gpt-5-mini-2025-08-07',
    'gpt-5-2025-08-07'
  ]).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      console.error(ERROR_CODES.NO_API_KEY);
      return new Response(JSON.stringify({ error: "Service configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const validationResult = inputSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(ERROR_CODES.INVALID_INPUT, "Validation failed:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid request format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, conversationId, model = "gpt-5-mini-2025-08-07" } = validationResult.data;

    // Rate limiting
    const { data: rateLimitData, error: rateLimitError } = await supabaseClient.rpc(
      "check_and_update_rate_limit",
      {
        p_user_id: user.id,
        p_endpoint: "chatgpt",
        p_max_requests: 20,
        p_window_seconds: 60,
      }
    );

    if (rateLimitError) {
      console.error("Rate limit check failed:", rateLimitError);
    }

    if (!rateLimitData) {
      console.error(ERROR_CODES.RATE_LIMIT_EXCEEDED, `User ${user.id}`);
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.info(`ChatGPT request from user ${user.id} with model ${model}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_completion_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(ERROR_CODES.OPENAI_API_ERROR, `Status: ${response.status}`, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("ChatGPT function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
