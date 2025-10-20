import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map internal error codes to safe public messages
const PUBLIC_ERROR_MAP: Record<string, string> = {
  ERR_ASSISTANT_NOT_CONFIGURED: 'Service configuration error. Please contact support.',
  ERR_SERVICE_CONFIG: 'Service temporarily unavailable. Please try again later.',
  ERR_THREAD_CREATE: 'Unable to start conversation. Please try again.',
  ERR_MESSAGE_SEND: 'Unable to process message. Please try again.',
  ERR_ASSISTANT_RUN: 'Unable to generate response. Please try again.',
  ERR_INTERNAL: 'An unexpected error occurred. Please try again.',
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
      conversationId: z.string().uuid().nullish(),
      files: z.array(z.object({
        name: z.string(),
        url: z.string().url(),
        type: z.string(),
        size: z.number(),
      })).optional(),
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

    const { message, threadId, conversationId, files } = validationResult.data;

    // Get user's active assistant from database
    const { data: assistantData, error: assistantError } = await supabase
      .from('user_assistants')
      .select('assistant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (assistantError || !assistantData) {
      const errorCode = 'ERR_ASSISTANT_NOT_CONFIGURED';
      console.error('[ASSISTANT_CONFIG]', { userId: user.id, timestamp: new Date().toISOString(), error: assistantError?.message, code: errorCode });
      return new Response(
        JSON.stringify({ error: PUBLIC_ERROR_MAP[errorCode] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const assistantId = assistantData.assistant_id;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      const errorCode = 'ERR_SERVICE_CONFIG';
      console.error('[SERVICE_CONFIG]', { userId: user.id, timestamp: new Date().toISOString(), issue: 'Missing API key', code: errorCode });
      return new Response(
        JSON.stringify({ error: PUBLIC_ERROR_MAP[errorCode] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get assistant settings from database
    const { data: settingsData } = await supabase
      .from('assistant_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('assistant_id', assistantId)
      .maybeSingle();

    const settings = settingsData || {
      enable_function_calling: true,
      temperature: null,
      max_tokens: null,
      custom_instructions: null,
    };

    console.log('Processing authenticated request with settings:', {
      function_calling: settings.enable_function_calling,
    });

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
        const errorCode = 'ERR_THREAD_CREATE';
        console.error('[THREAD_CREATE]', { userId: user.id, timestamp: new Date().toISOString(), status: threadResponse.status, code: errorCode });
        return new Response(
          JSON.stringify({ error: PUBLIC_ERROR_MAP[errorCode] }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const thread = await threadResponse.json();
      currentThreadId = thread.id;
      console.log('Thread created successfully');

      // Update conversation with thread_id if conversationId is provided
      if (conversationId) {
        await supabase
          .from('chat_conversations')
          .update({ thread_id: currentThreadId })
          .eq('id', conversationId)
          .eq('user_id', user.id);
      }
    }

    // Process file attachments - create vector store for file search
    let vectorStoreId: string | null = null;
    
    if (files && files.length > 0) {
      console.log('Processing file attachments with vector store:', files.length);
      
      try {
        // Create a vector store for this conversation if files are provided
        const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({
            name: `Conversation ${conversationId}`,
            expires_after: {
              anchor: 'last_active_at',
              days: 7
            }
          }),
        });

        if (!vectorStoreResponse.ok) {
          console.error('Error creating vector store:', await vectorStoreResponse.text());
        } else {
          const vectorStore = await vectorStoreResponse.json();
          vectorStoreId = vectorStore.id;
          console.log('Vector store created:', vectorStoreId);

          // Upload files to vector store in batch
          const fileUploads = [];
          
          for (const file of files) {
            try {
              // Download file from Supabase Storage using service role (file.url is the path)
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('chat-attachments')
                .download(file.url);
              
              if (downloadError || !fileData) {
                console.error('Error downloading file:', downloadError);
                continue;
              }

              // Upload to OpenAI Files API
              const formData = new FormData();
              formData.append('file', fileData, file.name);
              formData.append('purpose', 'assistants');

              const uploadResponse = await fetch('https://api.openai.com/v1/files', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'OpenAI-Beta': 'assistants=v2',
                },
                body: formData,
              });

              if (!uploadResponse.ok) {
                console.error('Error uploading file to OpenAI:', await uploadResponse.text());
                continue;
              }

              const uploadedFile = await uploadResponse.json();
              console.log('File uploaded to OpenAI:', uploadedFile.id);
              fileUploads.push(uploadedFile.id);

              // Store the OpenAI file ID in our database
              await supabase
                .from('message_attachments')
                .update({ openai_file_id: uploadedFile.id })
                .eq('file_url', file.url);

            } catch (error) {
              console.error('Error processing file:', error);
            }
          }

          // Add files to vector store in batch
          if (fileUploads.length > 0) {
            const batchResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/file_batches`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
                'OpenAI-Beta': 'assistants=v2',
              },
              body: JSON.stringify({
                file_ids: fileUploads
              }),
            });

            if (!batchResponse.ok) {
              console.error('Error adding files to vector store:', await batchResponse.text());
            } else {
              console.log('Files added to vector store in batch');
            }
          }
        }
      } catch (error) {
        console.error('Error setting up vector store:', error);
      }
    }

    // Add message to thread with attachments
    const messagePayload: any = {
      role: 'user',
      content: message,
    };

    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!messageResponse.ok) {
      const errorCode = 'ERR_MESSAGE_SEND';
      console.error('[MESSAGE_SEND]', { userId: user.id, threadId: currentThreadId, timestamp: new Date().toISOString(), status: messageResponse.status, code: errorCode });
      return new Response(
        JSON.stringify({ error: PUBLIC_ERROR_MAP[errorCode] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message sent successfully');

    // Build additional instructions from custom settings
    let additionalInstructions = settings.custom_instructions || '';

    // Prepare run parameters
    const runParams: any = {
      assistant_id: assistantId,
      stream: true,
    };

    // Add vector store to tool resources if files were uploaded
    if (vectorStoreId) {
      runParams.tool_resources = {
        file_search: {
          vector_store_ids: [vectorStoreId]
        }
      };
    }

    if (additionalInstructions) {
      runParams.additional_instructions = additionalInstructions;
    }

    if (settings.temperature !== null && settings.temperature !== undefined) {
      runParams.temperature = settings.temperature;
    }

    if (settings.max_tokens !== null && settings.max_tokens !== undefined) {
      runParams.max_completion_tokens = settings.max_tokens;
    }

    // Create run with streaming
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify(runParams),
    });

    if (!runResponse.ok) {
      const errorCode = 'ERR_ASSISTANT_RUN';
      console.error('[ASSISTANT_RUN]', { userId: user.id, threadId: currentThreadId, timestamp: new Date().toISOString(), status: runResponse.status, code: errorCode });
      return new Response(
        JSON.stringify({ error: PUBLIC_ERROR_MAP[errorCode] }),
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
    const errorCode = 'ERR_INTERNAL';
    console.error('[FUNCTION_ERROR]', { timestamp: new Date().toISOString(), error: error instanceof Error ? error.message : 'Unknown error', code: errorCode });
    return new Response(
      JSON.stringify({ error: PUBLIC_ERROR_MAP[errorCode] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
