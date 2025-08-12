import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Initialize the Gemini AI client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

export async function POST(request: NextRequest) {
  try {
    const { videoData, mimeType, prompt } = await request.json()

    if (!videoData) {
      return NextResponse.json({ error: 'No video data provided' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    // Prepare the content for Gemini
    const contents = [
      {
        inlineData: {
          mimeType: mimeType || 'video/webm',
          data: videoData,
        },
      },
      {
        text: prompt || 'Please analyze this video and provide a detailed summary of what you observe. Include any actions, objects, people, or notable events in the video.'
      }
    ]

    // Generate content using Gemini
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    })
    const text = response.text

    return NextResponse.json({ 
      analysis: text,
      success: true 
    })

  } catch (error) {
    console.error('Error analyzing video:', error)
    return NextResponse.json({ 
      error: 'Failed to analyze video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}