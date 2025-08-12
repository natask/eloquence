import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(request: NextRequest) {
  try {
    const { videoData, mimeType, prompt } = await request.json()

    if (!videoData) {
      return NextResponse.json({ error: 'No video data provided' }, { status: 400 })
    }

    // Debug logging
    const apiKey = process.env.GEMINI_API_KEY
    console.log('API Key status:', apiKey ? `Present (${apiKey.substring(0, 8)}...)` : 'Missing')
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'GEMINI_API_KEY not configured',
        details: 'Please add GEMINI_API_KEY to your .env.local file and restart the server'
      }, { status: 500 })
    }

    // Initialize the Gemini AI client
    const genAI = new GoogleGenAI({ apiKey })

    // Presentation coaching analysis prompt
    const defaultPrompt = `You are an expert presentation coach analyzing this speaking presentation video. Provide detailed feedback as follows:

**OVERALL PRESENTATION EVALUATION:**
Rate the presentation on a scale of 1-10 and provide overall assessment.

**DELIVERY ANALYSIS:**
- Voice clarity, pace, and volume
- Body language and posture
- Eye contact and engagement
- Confidence level and presence
- Use of gestures and movement

**CONTENT STRUCTURE:**
- Opening effectiveness
- Main points clarity
- Logical flow and transitions
- Conclusion strength
- Key messages delivery

**AREAS FOR IMPROVEMENT:**
Provide specific, actionable feedback with approximate timestamps (estimate based on video segments):

[Timestamp: 0:XX] - Specific issue observed
**Improvement:** Concrete suggestion for better delivery
**Better phrasing:** "Instead of saying X, try saying Y more concisely"

**SENTENCE-BY-SENTENCE COACHING:**
For unclear or wordy statements, provide:
- Original statement (approximate time)
- Improved, more concise version
- Reason for the change

**ACTION PLAN:**
3-5 specific steps the presenter should practice for their next presentation.

**STRENGTHS TO BUILD ON:**
Highlight what the presenter did well and should continue doing.

Be specific, actionable, and constructive in your coaching feedback.`

    // Prepare the content for Gemini
    const contents = [
      {
        inlineData: {
          mimeType: mimeType || 'video/webm',
          data: videoData,
        },
      },
      {
        text: prompt || defaultPrompt
      }
    ]

    console.log('Sending request to Gemini...')

    // Generate content using Gemini
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    })
    
    const text = response.text
    console.log('Gemini response received successfully')

    return NextResponse.json({ 
      analysis: text,
      success: true,
      prompt_used: prompt || defaultPrompt
    })

  } catch (error) {
    console.error('Error analyzing video:', error)
    
    // More detailed error handling
    let errorMessage = 'Failed to analyze video'
    let errorDetails = 'Unknown error'
    
    if (error instanceof Error) {
      errorDetails = error.message
      
      // Check for specific API key errors
      if (error.message.includes('API key not valid') || error.message.includes('INVALID_ARGUMENT')) {
        errorMessage = 'Invalid API key'
        errorDetails = 'The provided Gemini API key is not valid. Please check your API key in .env.local'
      } else if (error.message.includes('quota') || error.message.includes('exceeded')) {
        errorMessage = 'API quota exceeded'
        errorDetails = 'You have exceeded your Gemini API quota. Please check your usage limits.'
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails,
      success: false
    }, { status: 500 })
  }
}