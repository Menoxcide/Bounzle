import GameCanvas from '@/components/GameCanvas'

export const dynamic = 'force-dynamic'

export default function GamePage() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <GameCanvas />
    </div>
  )
}