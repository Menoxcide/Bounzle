'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AudioSettingsProps {
  onSoundToggle?: (enabled: boolean) => void
}

export default function AudioSettings({ onSoundToggle }: AudioSettingsProps) {
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    // Load sound preference from localStorage
    const savedPreference = localStorage.getItem('bounzle_sound_enabled')
    if (savedPreference !== null) {
      const isEnabled = savedPreference === 'true'
      setSoundEnabled(isEnabled)
      if (onSoundToggle) {
        onSoundToggle(isEnabled)
      }
    }
  }, [onSoundToggle])

  const toggleSound = () => {
    const newEnabled = !soundEnabled
    setSoundEnabled(newEnabled)
    localStorage.setItem('bounzle_sound_enabled', String(newEnabled))
    
    if (onSoundToggle) {
      onSoundToggle(newEnabled)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Audio Settings</span>
          <span className="text-lg">
            {soundEnabled ? '🔊' : '🔇'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="sound-toggle" className="text-lg">
            Sound Effects
          </Label>
          <Switch
            id="sound-toggle"
            checked={soundEnabled}
            onCheckedChange={toggleSound}
          />
        </div>
        
        <div className="mt-6 text-sm text-gray-500">
          <p>Toggle sound effects on/off</p>
          <p className="mt-2">Your preference is saved automatically</p>
        </div>
      </CardContent>
    </Card>
  )
}