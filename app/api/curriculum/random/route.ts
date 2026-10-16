import { NextResponse } from 'next/server'

const FALLBACK_SENTENCES: Record<number, Array<{ text: string; cefr: string; source: string }>> = {
  1: [
    { text: 'The quick brown fox jumps over the lazy dog near the river bank.', cefr: 'A1', source: 'fallback_corpus' },
    { text: 'Please open your book to page forty and read the first paragraph quietly.', cefr: 'A2', source: 'fallback_corpus' },
    { text: 'Every morning I drink a hot cup of coffee while watching the sunrise.', cefr: 'A1', source: 'fallback_corpus' },
    { text: 'Children love playing outdoor games in the sunny park after finishing homework.', cefr: 'A2', source: 'fallback_corpus' },
  ],
  2: [
    { text: 'Environmental scientists have discovered new methods to capture carbon emissions directly from industrial factory exhaust.', cefr: 'B1', source: 'fallback_corpus' },
    { text: 'Effective communication requires active listening and the ability to articulate complex thoughts with clarity.', cefr: 'B2', source: 'fallback_corpus' },
    { text: 'Technological advancements in renewable energy sources are rapidly transforming global economic infrastructure and power distribution.', cefr: 'B2', source: 'fallback_corpus' },
    { text: 'Museum curators carefully examine historical artifacts to preserve cultural heritage for future generations.', cefr: 'B1', source: 'fallback_corpus' },
  ],
  3: [
    { text: 'Sophisticated macroeconomic policies must navigate the delicate equilibrium between controlling persistent inflationary pressures and fostering sustainable employment growth.', cefr: 'C1', source: 'fallback_corpus' },
    { text: 'Philosophical inquiries into the nature of consciousness often challenge our fundamental assumptions regarding subjective experience and neural correlates.', cefr: 'C2', source: 'fallback_corpus' },
    { text: 'Interdisciplinary collaboration across disparate scientific domains frequently yields breakthrough innovations that reshape our understanding of quantum mechanics.', cefr: 'C1', source: 'fallback_corpus' },
    { text: 'Unprecedented geopolitical shifts demand rigorous diplomatic engagement and multilateral cooperation among sovereign democratic states.', cefr: 'C2', source: 'fallback_corpus' },
  ],
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const levelParam = url.searchParams.get('level') || '1'
    const levelNumber = parseInt(levelParam, 10)

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
                // Enforce word-count bounds (8 to 22 words) and CEFR alignment
                if (wordCount >= 8 && wordCount <= 22 && targetCefrs.includes(sentenceCefr)) {
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
    // Return graceful fallback matching level 1
    const fallback = FALLBACK_SENTENCES[1][0]
    return NextResponse.json(fallback)
  }
}
