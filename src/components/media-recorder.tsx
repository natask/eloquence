'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Video, 
  Mic, 
  Square, 
  Play, 
  Download,
  Camera,
  Brain,
  Loader2
} from 'lucide-react'

type RecordingType = 'video' | 'audio'

interface Recording {
  blob: Blob
  url: string
  type: RecordingType
  duration: number
  timestamp: Date
  analysis?: string
}

export default function MediaRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [recordingType, setRecordingType] = useState<RecordingType>('video')
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null)
  
  const mediaRecorderRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const requestPermissions = async () => {
    try {
      const constraints = recordingType === 'video' 
        ? { video: true, audio: true }
        : { audio: true }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setHasPermission(true)
      
      if (videoPreviewRef.current && recordingType === 'video') {
        videoPreviewRef.current.srcObject = stream
      }
      
      return stream
    } catch (error) {
      console.error('Permission denied:', error)
      setHasPermission(false)
      return null
    }
  }

  const startRecording = async () => {
    try {
      const stream = await requestPermissions()
      if (!stream) return

      streamRef.current = stream
      
      // Check if MediaRecorder is available
      if (typeof window !== 'undefined' && 'MediaRecorder' in window) {
        const MediaRecorderClass = (window as any).MediaRecorder
        const mediaRecorder = new MediaRecorderClass(stream)
        mediaRecorderRef.current = mediaRecorder

        const chunks: Blob[] = []
        
        mediaRecorder.ondataavailable = (event: any) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { 
            type: recordingType === 'video' ? 'video/webm' : 'audio/webm'
          })
          const url = URL.createObjectURL(blob)
          
          const newRecording: Recording = {
            blob,
            url,
            type: recordingType,
            duration: recordingTime,
            timestamp: new Date()
          }
          
          setRecordings(prev => [...prev, newRecording])
          setRecordingTime(0)
          
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
          }
        }

        mediaRecorder.start()
        setIsRecording(true)
        
        // Start recording timer
        intervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      } else {
        console.error('MediaRecorder is not supported')
      }
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }

  const downloadRecording = (recording: Recording) => {
    const a = document.createElement('a')
    a.href = recording.url
    a.download = `recording-${recording.timestamp.getTime()}.${recording.type === 'video' ? 'webm' : 'webm'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix to get just the base64 data
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Failed to convert blob to base64'))
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const analyzeVideo = async (recording: Recording, index: number) => {
    if (recording.type !== 'video') {
      alert('Video analysis is only available for video recordings')
      return
    }

    setAnalyzingIndex(index)

    try {
      const base64Data = await convertBlobToBase64(recording.blob)
      
      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoData: base64Data,
          mimeType: 'video/webm',
          prompt: 'Please analyze this video and provide a detailed summary of what you observe. Include any actions, objects, people, or notable events in the video.'
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update the recording with analysis
        setRecordings(prev => prev.map((rec, i) => 
          i === index ? { ...rec, analysis: result.analysis } : rec
        ))
      } else {
        console.error('Analysis failed:', result.error)
        alert(`Analysis failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error analyzing video:', error)
      alert('Failed to analyze video. Please try again.')
    } finally {
      setAnalyzingIndex(null)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Eloquence</h1>
        <p className="text-muted-foreground text-lg">
          Record high-quality video and audio with AI-powered analysis
        </p>
      </div>

      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Recording Studio
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={recordingType === 'video' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecordingType('video')}
                disabled={isRecording}
              >
                <Video className="h-4 w-4 mr-2" />
                Video
              </Button>
              <Button
                variant={recordingType === 'audio' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecordingType('audio')}
                disabled={isRecording}
              >
                <Mic className="h-4 w-4 mr-2" />
                Audio
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Preview */}
          {recordingType === 'video' && (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Recording Status */}
          {isRecording && (
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Recording</span>
              </div>
              <Badge variant="outline" className="font-mono">
                {formatTime(recordingTime)}
              </Badge>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="gap-2"
                disabled={hasPermission === false}
              >
                {recordingType === 'video' ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                className="gap-2"
              >
                <Square className="h-5 w-5" />
                Stop Recording
              </Button>
            )}
          </div>

          {hasPermission === false && (
            <div className="text-center py-4">
              <p className="text-destructive text-sm">
                Camera and microphone permissions are required for recording.
                Please enable them and refresh the page.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recordings List */}
      {recordings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Your Recordings ({recordings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recordings.map((recording, index) => (
                <div key={index} className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant={recording.type === 'video' ? 'default' : 'secondary'}>
                        {recording.type === 'video' ? (
                          <Video className="h-3 w-3 mr-1" />
                        ) : (
                          <Mic className="h-3 w-3 mr-1" />
                        )}
                        {recording.type}
                      </Badge>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {recording.type === 'video' ? 'Video Recording' : 'Audio Recording'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(recording.duration)} • {recording.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {recording.type === 'video' ? (
                        <video
                          src={recording.url}
                          controls
                          className="w-24 h-14 rounded object-cover"
                        />
                      ) : (
                        <audio src={recording.url} controls className="h-8" />
                      )}
                      <Button
                        onClick={() => downloadRecording(recording)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {recording.type === 'video' && (
                        <Button
                          onClick={() => analyzeVideo(recording, index)}
                          size="sm"
                          variant="secondary"
                          disabled={analyzingIndex === index}
                        >
                          {analyzingIndex === index ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Brain className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Analysis Results */}
                  {recording.analysis && (
                    <div className="ml-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4" />
                        <span className="text-sm font-medium">AI Analysis</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {recording.analysis}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}