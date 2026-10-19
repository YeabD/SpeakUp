import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { level_number, session_number, turn_index, conversation_history, user_last_input } = body

    if (level_number === undefined) {
      return NextResponse.json({ error: 'Missing level_number' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    // Predefined curriculum seed topics per level / session for fallback or context injection
    const levelTopics: Record<number, string[]> = {
      1: [
        'What kind of music do you usually listen to when you need to focus?',
        'How do you typically start your weekday mornings?',
        'What is your favorite way to spend a relaxing weekend afternoon?',
        'Do you prefer reading physical books or digital e-readers, and why?',
        'What cuisine or type of food do you find yourself craving most often?',
        'How do you usually organize your tasks and schedule your week?',
        'What is a hobby or skill you started learning recently?',
        'Do you enjoy traveling to bustling cities or quiet nature spots?',
        'What is your go-to beverage when you visit a cafe?',
        'How do you prefer to keep in touch with close friends and family?',
        'What kind of movies or TV shows do you watch to unwind?',
        'What was your favorite subject when you were in school?',
        'Do you prefer working early in the morning or late at night?',
        'What is a simple daily routine that always puts you in a good mood?',
        'How do you usually celebrate birthdays or special milestones?'
      ],
      2: [
        'Man, traffic on the interstate this morning was an absolute nightmare.',
        'I spent three hours trying to fix my Wi-Fi router yesterday and got nowhere.',
        'Everybody in the office is obsessed with this new productivity app.',
        'The weather forecast keeps changing every single hour today.',
        'Trying to find parking downtown on a Friday night is virtually impossible.',
        'My smart home assistant misunderstood every single command I gave it today.',
        'The cost of groceries seems to go up every time I go to the supermarket.',
        'Everyone is talking about this new sci-fi series streaming right now.',
        'Trying to assemble flat-pack furniture without instructions is a recipe for disaster.',
        'My laptop battery decided to die right in the middle of an important presentation.',
        'Public transport was delayed by 40 minutes during rush hour today.',
        'I accidentally brewed decaf coffee instead of regular roast this morning.',
        'Trying to schedule a meeting across three different time zones is exhausting.',
        'The local park was completely packed with people enjoying the sunshine.',
        'My plant collection has grown so much that I am running out of windowsill space.'
      ],
      3: [
        'Remote work completely destroys company culture and stifles mentorship, don’t you think?',
        'Artificial intelligence is going to completely eliminate entry-level creative jobs within five years.',
        'Traditional higher education is becoming obsolete compared to online micro-credentials.',
        'Social media algorithms have done more damage to human attention spans than anything else.',
        'Universal basic income is the only viable solution to future automation job losses.',
        'Modern urban planning prioritizes cars over human well-being far too much.',
        'Standardized testing in schools measures compliance rather than actual intelligence.',
        'The obsession with productivity and constant self-improvement is burning out a whole generation.',
        'Cryptocurrency and decentralized finance will completely replace traditional banking.',
        'Space exploration is a waste of resources while we have so many unsolved crises on Earth.',
        'Consumerism is destroying our sense of community and connection with nature.',
        'Algorithmic curation of news and entertainment creates echo chambers that threaten democracy.',
        'The four-day work week should be mandated by law globally immediately.',
        'Meritocracy is largely a myth in modern highly unequal economies.',
        'Genetics and upbringing dictate our success far more than personal willpower ever could.'
      ]
    }

    const sessionList = levelTopics[level_number] || levelTopics[1]
    const baseTopic = sessionList[(session_number - 1) % sessionList.length]

    if (!apiKey) {
      // Fallback simulation
      if (turn_index === 0) {
        return NextResponse.json({ ai_reply: baseTopic })
      }
      const responses = [
        `That is a really interesting perspective on ${baseTopic.toLowerCase().slice(0, 20)}... Can you elaborate a bit more on why you feel that way?`,
        `I see! And how does that usually impact your daily routine or long-term goals?`,
        `That makes sense, although some might argue the exact opposite. What is your take on that angle?`,
        `Fascinating point. Let's keep the momentum going—what would be the next logical step in your view?`,
        `I appreciate how direct you were there. How often do you encounter this situation?`
      ]
      const reply = responses[(turn_index + (user_last_input?.length || 0)) % responses.length]
      return NextResponse.json({ ai_reply: reply })
    }

    const ai = new GoogleGenAI({ apiKey })

    const systemInstruction = `You are an AI conversation partner in a rapid conversational ping-pong training module (Reactivity Engine).
Level ${level_number}:
- Level 1: Predictable straightforward questions.
- Level 2: Casual observations, complaints, or unprompted remarks.
- Level 3: Controversial takes or provocative statements.

Rules:
- Respond with a single punchy, conversational sentence (max 2 sentences).
- Keep the ping-pong rally rapid and engaging.
- Do not lecture; prompt the user naturally to keep the volley alive.`

    const contents = [
      { role: 'user', parts: [{ text: `Base topic/prompt for this session: "${baseTopic}". Conversation history so far: ${JSON.stringify(conversation_history || [])}. User just said: "${user_last_input || 'Initial serve'}". Generate the next AI conversational reply:` }] }
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 150,
        temperature: 0.7,
      }
    })

    const aiReply = response.text?.trim() || baseTopic

    return NextResponse.json({ ai_reply: aiReply })
  } catch (err: unknown) {
    console.error('Ping-pong turn API error:', err)
    return NextResponse.json({
      ai_reply: 'That is quite fascinating! How does that usually affect your day-to-day routine?'
    })
  }
}
