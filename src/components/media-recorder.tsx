'use client'

import { useState, useRef, useEffect } from 'react'
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
  Loader2,
  Maximize2,
  Minimize2,
  Trash2,
  Settings
} from 'lucide-react'
import { videoStorage, type StoredRecording } from '@/lib/video-storage'

type RecordingType = 'video' | 'audio'

export default function MediaRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<StoredRecording[]>([])
  const [recordingType, setRecordingType] = useState<RecordingType>('video')
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCustomPrompt, setShowCustomPrompt] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  
  const mediaRecorderRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load existing recordings on component mount
  useEffect(() => {
    loadRecordings()
  }, [])

  const loadRecordings = async () => {
    try {
      const storedRecordings = await videoStorage.getAllRecordings()
      setRecordings(storedRecordings)
    } catch (error) {
      console.error('Error loading recordings:', error)
    } finally {
      setIsLoading(false)
    }
  }

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

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { 
            type: recordingType === 'video' ? 'video/webm' : 'audio/webm'
          })
          const url = URL.createObjectURL(blob)
          
          const newRecording = {
            blob,
            url,
            type: recordingType,
            duration: recordingTime,
            timestamp: new Date()
          }
          
          try {
            // Save to IndexedDB
            const id = await videoStorage.saveRecording(newRecording)
            const storedRecording = { ...newRecording, id }
            
            // Update local state
            setRecordings(prev => [storedRecording, ...prev])
            setRecordingTime(0)
          } catch (error) {
            console.error('Error saving recording:', error)
          }
          
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
          }
        }

        mediaRecorder.start()
        setIsRecording(true)
        
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

  const downloadRecording = (recording: StoredRecording) => {
    const a = document.createElement('a')
    a.href = recording.url
    a.download = `eloquence-${recording.type}-${recording.timestamp.getTime()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const deleteRecording = async (recording: StoredRecording) => {
    if (!confirm('Are you sure you want to delete this recording?')) return
    
    try {
      await videoStorage.deleteRecording(recording.id)
      setRecordings(prev => prev.filter(r => r.id !== recording.id))
      
      // Clean up blob URL
      URL.revokeObjectURL(recording.url)
      
      // Close expanded view if this recording was expanded
      if (expandedVideoId === recording.id) {
        setExpandedVideoId(null)
      }
    } catch (error) {
      console.error('Error deleting recording:', error)
    }
  }

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
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

  const analyzeVideo = async (recording: StoredRecording, useCustomPrompt = false) => {
    if (recording.type !== 'video') {
      alert('Video analysis is only available for video recordings')
      return
    }

    setAnalyzingId(recording.id)

    try {
      const base64Data = await convertBlobToBase64(recording.blob)
      
      const promptToUse = useCustomPrompt ? customPrompt : undefined
      
      const response = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoData: base64Data,
          mimeType: 'video/webm',
          prompt: promptToUse
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update in IndexedDB
        const analysisResult = `**Analysis Result:**\n\n${result.analysis}\n\n**Prompt Used:**\n${result.prompt_used}`
        await videoStorage.updateRecording(recording.id, {
          analysis: analysisResult
        })
        
        // Update local state
        setRecordings(prev => prev.map(rec =>
          rec.id === recording.id ? {
            ...rec,
            analysis: analysisResult
          } : rec
        ))
        
        // Close custom prompt if it was open
        setShowCustomPrompt(null)
        setCustomPrompt('')
      } else {
        console.error('Analysis failed:', result.error)
        alert(`Analysis failed: ${result.error}\n\nDetails: ${result.details}`)
      }
    } catch (error) {
      console.error('Error analyzing video:', error)
      alert('Failed to analyze video. Please try again.')
    } finally {
      setAnalyzingId(null)
    }
  }

  const openCustomPrompt = (recordingId: string) => {
    setShowCustomPrompt(recordingId)
    setCustomPrompt('')
  }

  const closeCustomPrompt = () => {
    setShowCustomPrompt(null)
    setCustomPrompt('')
  }

  const toggleVideoExpanded = (recordingId: string) => {
    setExpandedVideoId(prev => prev === recordingId ? null : recordingId)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading your recordings...</span>
        </div>
      </div>
    )
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
            <div className="space-y-6">
              {recordings.map((recording) => (
                <div key={recording.id} className="space-y-4">
                  <div className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="flex items-start gap-4">
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
                      {recording.type === 'video' && (
                        <Button
                          onClick={() => toggleVideoExpanded(recording.id)}
                          size="sm"
                          variant="outline"
                        >
                          {expandedVideoId === recording.id ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        onClick={() => downloadRecording(recording)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {recording.type === 'video' && (
                        <>
                          <Button
                            onClick={() => analyzeVideo(recording)}
                            size="sm"
                            variant="secondary"
                            disabled={analyzingId === recording.id}
                          >
                            {analyzingId === recording.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Brain className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            onClick={() => openCustomPrompt(recording.id)}
                            size="sm"
                            variant="outline"
                            disabled={analyzingId === recording.id}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => deleteRecording(recording)}
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced Video/Audio Player */}
                  <div className={`${expandedVideoId === recording.id ? 'block' : 'flex justify-center'}`}>
                    {recording.type === 'video' ? (
                      <video
                        src={recording.url}
                        controls
                        className={expandedVideoId === recording.id 
                          ? "w-full aspect-video rounded-lg" 
                          : "w-48 h-32 rounded object-cover"
                        }
                      />
                    ) : (
                      <div className="w-full max-w-md">
                        <audio src={recording.url} controls className="w-full" />
                      </div>
                    )}
                  </div>

                  {/* Custom Prompt Input */}
                  {showCustomPrompt === recording.id && (
                    <div className="ml-4 p-4 bg-muted/30 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className="h-4 w-4" />
                        <span className="text-sm font-medium">Custom Analysis Prompt</span>
                      </div>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Enter your custom prompt for analyzing this video..."
                        className="w-full min-h-[100px] p-3 text-sm border rounded-md bg-background"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => analyzeVideo(recording, true)}
                          size="sm"
                          disabled={!customPrompt.trim() || analyzingId === recording.id}
                        >
                          Analyze with Custom Prompt
                        </Button>
                        <Button
                          onClick={closeCustomPrompt}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Analysis Results */}
                  {recording.analysis && (
                    <div className="ml-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4" />
                        <span className="text-sm font-medium">AI Analysis</span>
                      </div>
                      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {recording.analysis}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {recordings.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No recordings yet</h3>
            <p className="text-muted-foreground mb-4">
              Start by recording your first video or audio clip
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}