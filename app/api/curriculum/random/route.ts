import { NextResponse } from 'next/server'

const WORD_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 40, max: 50 },
  2: { min: 80, max: 100 },
  3: { min: 100, max: 120 },
}

const FALLBACK_SENTENCES: Record<number, Array<{ text: string; cefr: string; source: string }>> = {
  1: [
    { text: 'Maya arrives at the community library just before noon. She returns two novels, greets the librarian, and asks for a book about local history. The librarian shows her a quiet shelf near the window, where Maya sits down and begins reading with a cup of tea.', cefr: 'A2', source: 'fallback_corpus' },
    { text: 'Could you help me find the train station? Leo asks. Of course, the shopkeeper replies. Walk past the bakery, turn left at the traffic lights, and continue for two blocks. Leo thanks her, checks the map on his phone, and heads down the busy street.', cefr: 'A2', source: 'fallback_corpus' },
    { text: 'On Saturday morning, our neighbors meet in the shared garden. Some people pull weeds while others plant tomatoes and herbs. The children fill small watering cans and carefully water each row. By lunchtime, everyone is tired but proud of the bright, tidy space they created together.', cefr: 'A2', source: 'fallback_corpus' },
  ],
  2: [
    { text: 'During Monday morning planning meeting, Priya explained that the product launch might slip by one week because the testing team had found two serious defects. Instead of assigning blame, she asked each department to describe its biggest obstacle. The engineers needed clearer customer examples, while the support team needed an updated demonstration. Together, they agreed to hold a short check-in every afternoon, share progress in one document, and invite three customers to test the revised version on Friday. By the end of the meeting, everyone understood the new schedule and their responsibility for keeping it realistic.', cefr: 'B2', source: 'fallback_corpus' },
    { text: 'When Daniel moved to a new city for work, his first week felt unexpectedly difficult. The office systems were unfamiliar, his commute involved two crowded buses, and he knew nobody nearby. On Wednesday, a colleague invited him to join a lunchtime walking group. The conversation was casual, but it helped him learn where people bought groceries, exercised, and met after work. Over the next month, Daniel kept joining the walks and began asking more questions during team meetings. The city did not become simpler overnight, yet it gradually started to feel like a place where he could build a routine.', cefr: 'B2', source: 'fallback_corpus' },
    { text: 'A small design agency received an urgent request from a long-term client on Thursday afternoon. The client wanted a complete presentation by Monday, although the usual process required two weeks. The project manager reviewed the deadline with the team and separated essential work from optional improvements. One designer created the visual system, another organized the data, and a writer simplified the technical language. They sent an early draft on Saturday so the client could correct major misunderstandings. Because everyone communicated clearly and protected time for rest, the team delivered a focused presentation without turning the weekend into a crisis.', cefr: 'B2', source: 'fallback_corpus' },
  ],
  3: [
    { text: 'Although remote work was initially presented as a straightforward exchange between office space and digital convenience, its long-term effects are considerably more complicated. Employees often value autonomy, yet they may also struggle to recognize when the working day has actually ended. Managers, meanwhile, can mistake visible online activity for meaningful progress, encouraging a culture of constant signaling rather than thoughtful production. A sustainable policy therefore requires more than deciding how many days people should attend an office. It must clarify which tasks benefit from shared presence, how decisions are documented, and when colleagues may remain unavailable without appearing uncommitted. In practice, the strongest arrangements evolve through regular feedback instead of relying on a universal formula.', cefr: 'C1', source: 'fallback_corpus' },
    { text: 'Public debate frequently treats uncertainty as evidence that experts have failed, even though uncertainty is often the most honest result of careful analysis. A forecast can identify several plausible outcomes without predicting exactly which one will occur, particularly when human behavior influences the system being studied. The difficulty is communicative as much as scientific: audiences want a clear recommendation, while researchers are trained to preserve qualifications and competing explanations. If officials remove every caveat, they create false confidence; if they present every technical limitation, they risk obscuring the practical decision. Responsible communication must therefore distinguish what is known, what remains contested, and which action is reasonable despite incomplete information, while remaining open to revision as stronger evidence emerges.', cefr: 'C2', source: 'fallback_corpus' },
    { text: 'Cities often announce ambitious transport strategies, but the success of those plans depends less on a dramatic launch than on thousands of ordinary journeys. A protected cycle lane, for example, achieves little if it ends abruptly at a dangerous junction, while a frequent bus service remains unattractive when passengers cannot rely on accurate arrival information. Policymakers must examine the entire journey rather than isolated infrastructure, including cost, accessibility, weather, personal safety, and connections between different modes. They must also recognize that habits change gradually: commuters are unlikely to abandon a familiar route after one successful trial. Consistent service, transparent evaluation, and patient investment can eventually make the sustainable option not merely virtuous, but genuinely convenient.', cefr: 'C1', source: 'fallback_corpus' },
  ],
}

export async function GET(request: Request) {
  const levelParam = new URL(request.url).searchParams.get('level') || '1'
  const parsedLevel = parseInt(levelParam, 10)
  const levelNumber = parsedLevel >= 3 ? 3 : parsedLevel === 2 ? 2 : 1
  const wordLimits = WORD_LIMITS[levelNumber]

  try {
    // Map internal numeric levels to standard CEFR tiers
    let targetCefrs = ['A1', 'A2']
    if (levelNumber === 2) targetCefrs = ['B1', 'B2']
    else if (levelNumber >= 3) targetCefrs = ['C1', 'C2']

    const hfApiKey = process.env.HUGGINGFACE_API_KEY
    const randomOffset = Math.floor(Math.random() * 800)

    let fetchedSentences: Array<{ text: string; cefr: string; source: string }> = []

    if (hfApiKey) {
      try {
        const hfRes = await fetch(
          `https://datasets-server.huggingface.co/rows?dataset=UniversalCEFR/UniversalCEFR&config=default&split=train&offset=${randomOffset}&limit=100`,
          {
            headers: {
              Authorization: `Bearer ${hfApiKey}`,
              'Content-Type': 'application/json',
            },
            next: { revalidate: 60 },
          }
        )

        if (hfRes.ok) {
          const data = await hfRes.json()
          if (data && data.rows && Array.isArray(data.rows)) {
            for (const rowItem of data.rows) {
              const row = rowItem.row || rowItem
              // Typical column names in CEFR datasets: text, sentence, cefr, level, proficiency
              const sentenceText = row.text || row.sentence || row.content
              const sentenceCefr = (row.cefr || row.level || row.proficiency || 'A1').toUpperCase()

              if (sentenceText && typeof sentenceText === 'string') {
                const wordCount = sentenceText.trim().split(/\s+/).length
                if (
                  wordCount >= wordLimits.min &&
                  wordCount <= wordLimits.max &&
                  targetCefrs.includes(sentenceCefr)
                ) {
                  fetchedSentences.push({
                    text: sentenceText.trim(),
                    cefr: sentenceCefr,
                    source: 'UniversalCEFR/UniversalCEFR',
                  })
                }
              }
            }
          }
        }
      } catch (hfErr) {
        console.warn('Hugging Face API fetch warning, using fallback corpus:', hfErr)
      }
    }

    // Fallback if HF returned no candidates or API key is absent
    if (fetchedSentences.length === 0) {
      const levelFallbacks = FALLBACK_SENTENCES[levelNumber] || FALLBACK_SENTENCES[1]
      const randomIndex = Math.floor(Math.random() * levelFallbacks.length)
      const selected = levelFallbacks[randomIndex]
      return NextResponse.json(selected)
    }

    // Return a random pick from filtered fetched sentences
    const randomPick = fetchedSentences[Math.floor(Math.random() * fetchedSentences.length)]
    return NextResponse.json(randomPick)
  } catch (err: any) {
    console.error('Curriculum ingestion route error:', err)
    const fallback = FALLBACK_SENTENCES[levelNumber][0]
    return NextResponse.json(fallback)
  }
}
