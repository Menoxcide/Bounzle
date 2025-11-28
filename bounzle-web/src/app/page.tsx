import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-blue-100">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-4xl font-bold text-gray-800">Bounzle</h1>
        <p className="text-xl text-gray-600">
          Zesty one-tap endless bouncer with AI-procedural level generation
        </p>
        
        <div className="flex flex-col gap-4 mt-8">
          <Link href="/game">
            <Button className="text-lg px-8 py-6 w-full">
              Play Game
            </Button>
          </Link>
          
          <Link href="/leaderboard">
            <Button variant="outline" className="text-lg px-8 py-6 w-full">
              View Leaderboard
            </Button>
          </Link>
        </div>
        
        <div className="mt-8 text-gray-500">
          <p>Click or tap to control the bouncing ball</p>
          <p>Navigate through the gaps to score points</p>
        </div>
      </div>
    </div>
  );
}