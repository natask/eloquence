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

    // Enhanced analysis prompt
    const defaultPrompt = `Analyze this video recording in detail and provide a comprehensive summary. Please include:

1. **Visual Content**: Describe what you see - people, objects, scenes, environment
2. **Actions & Movement**: What activities or movements are taking place?
3. **Audio Context**: Any speech, sounds, or audio elements you can identify
4. **Setting & Context**: Where does this appear to be taking place?
5. **Key Moments**: Highlight any significant events or changes in the video
6. **Overall Summary**: Provide a concise overview of the video's main content

Please be thorough but concise in your analysis.`

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