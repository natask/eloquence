import MediaRecorder from '@/components/media-recorder'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto py-8">
        <MediaRecorder />
      </div>
    </main>
  )
}
