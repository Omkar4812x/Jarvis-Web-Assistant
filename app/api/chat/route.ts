// Simple rule-based AI responses (completely free)

// Simple function to generate responses based on keywords
function generateResponse(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  // JARVIS personality responses
  if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi') || lowerPrompt.includes('hey')) {
    return "Good day! I'm J.A.R.V.I.S., your AI assistant. How may I assist you today?";
  }
  
  if (lowerPrompt.includes('jarvis')) {
    return "At your service, sir. How can I assist you?";
  }
  
  if (lowerPrompt.includes('how are you')) {
    return "I'm functioning optimally, thank you for asking. How may I be of service?";
  }
  
  if (lowerPrompt.includes('weather')) {
    return "I'm afraid I don't have access to real-time weather data without an API key. However, I recommend checking your local weather service.";
  }
  
  if (lowerPrompt.includes('time')) {
    return `The current time is ${new Date().toLocaleTimeString()}. Is there anything specific about the time you'd like to know?`;
  }
  
  if (lowerPrompt.includes('thank')) {
    return "You're welcome. It's my pleasure to assist you.";
  }
  
  if (lowerPrompt.includes('help')) {
    return "I'm here to help. You can ask me general questions, request information, or ask for assistance with various tasks.";
  }
  
  // Default responses
  const defaultResponses = [
    "I understand. How else may I assist you?",
    "Fascinating. Tell me more about what you need.",
    "I've processed your request. How can I further assist you?",
    "I'm at your service. What else would you like to know?",
    "That's an interesting point. How may I be of further assistance?",
    "I've noted your input. What would you like to explore next?",
    "I'm here to help. Please let me know what else you need."
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}
import {
  convertToModelMessages,
  streamText,
  tool,
  type UIMessage,
} from "ai"
import { z } from "zod"

export const maxDuration = 60

async function searchGoogle(query: string): Promise<string> {
  const apiKey = process.env.SEARCHAPI_API_KEY
  if (!apiKey) {
    return "Search is not available - no API key configured."
  }

  try {
    const url = new URL("https://www.searchapi.io/api/v1/search")
    url.searchParams.set("engine", "google")
    url.searchParams.set("q", query)
    url.searchParams.set("api_key", apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) {
      return `Search failed with status ${res.status}`
    }

    const data = await res.json()
    const results: string[] = []

    // Answer box
    if (data.answer_box?.answer) {
      results.push(`Quick Answer: ${data.answer_box.answer}`)
    }
    if (data.answer_box?.snippet) {
      results.push(`Quick Answer: ${data.answer_box.snippet}`)
    }

    // Knowledge graph
    if (data.knowledge_graph?.description) {
      results.push(`Overview: ${data.knowledge_graph.description}`)
    }

    // Organic results
    if (data.organic_results) {
      const topResults = data.organic_results.slice(0, 5)
      for (const r of topResults) {
        results.push(`- ${r.title}: ${r.snippet || "No description"}`)
      }
    }

    return results.length > 0
      ? results.join("\n")
      : "No relevant results found."
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : "Unknown error"}`
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  console.log('Request body:', JSON.stringify(body, null, 2));
  const { messages }: { messages: UIMessage[] } = body;

  try {
    // Convert messages to a single prompt for Ollama
    const systemPrompt = `You are J.A.R.V.I.S., an advanced AI assistant inspired by the AI from Iron Man. You are intelligent, articulate, and slightly witty with a sophisticated British demeanor. Keep your responses concise but helpful - aim for 2-4 sentences for simple queries, more for complex ones.`;
    
    // Build the conversation history
    let conversation = systemPrompt + "\n\n";
    for (const msg of messages) {
      // Extract text content from the message parts
      const textContent = Array.isArray(msg.parts) 
        ? msg.parts.filter(p => typeof p === 'object' && p !== null && 'type' in p && p.type === 'text' && 'text' in p)
                  .map(p => (p as { text: string }).text)
                  .join(' ')
        : '';
      
      if (msg.role === 'user') {
        conversation += `Human: ${textContent}\n`;
      } else if (msg.role === 'assistant') {
        conversation += `J.A.R.V.I.S.: ${textContent}\n`;
      }
    }
    conversation += "J.A.R.V.I.S.:";
    
    // Generate response
    console.log('Generating response for prompt:', conversation);
    const response = generateResponse(conversation);
    console.log('Generated response:', response);
    
    // Create response in the format expected by the frontend
    const responseFormat = {
      id: 'response-' + Date.now(),
      role: 'assistant',
      content: [{ type: 'text', text: response }],
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(responseFormat), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    
    // Handle any errors in the response generation
    const errorMessage = {
      type: 'text-delta',
      text: "I'm sorry, but I'm having trouble processing your request. I'm a rule-based assistant that simulates AI responses.",
      messageId: 'error-' + Date.now(),
      finishReason: 'error',
    };
    
    const encoder = new TextEncoder();
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify(errorMessage) + '\n'));
        controller.close();
      },
    });
    
    return new Response(errorStream, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
