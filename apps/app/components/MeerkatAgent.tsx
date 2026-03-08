import React from 'react';
import { SpeechBubble } from './SpeechBubble';

export type AnimState = 'idle' | 'working' | 'panicked';

type MeerkatAgentProps = {
  id: string;
  name: string;
  state: AnimState;
  position: { x: string; y: string };
  currentBubble?: { message: string; type: 'support' | 'attack' | 'normal' } | null;
  onBubbleComplete?: () => void;
};

export const MeerkatAgent: React.FC<MeerkatAgentProps> = ({ state, position, currentBubble, onBubbleComplete }) => {
  // Use the single spritesheet. 
  // We simulate animation frames by shifting background position.
  // Assuming a 300px wide image with 3 distinct 100px square characters for simplicity
  
  const getBackgroundPosition = () => {
    switch (state) {
      case 'idle': return '0% 0%';
      case 'working': return '50% 0%';
      case 'panicked': return '100% 0%';
      default: return '0% 0%';
    }
  };

  return (
    <div 
      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-500 hover:scale-110"
      style={{
        left: position.y, // using the previous mapped values (we stored CSS left in 'y')
        top: position.x   // stored CSS top in 'x'
      }}
    >
      {/* Speech Bubble Layer */}
      {currentBubble && (
        <SpeechBubble 
          message={currentBubble.message} 
          type={currentBubble.type} 
          onComplete={onBubbleComplete} 
        />
      )}

      {/* Character Sprite Layer */}
      <div 
        className="w-16 h-16 rounded-full shadow-lg bg-white overflow-hidden relative border-2 border-amber-900"
      >
        <div 
          className="absolute inset-0 bg-no-repeat bg-cover"
          style={{
            backgroundImage: "url('/sprites.png')",
            backgroundPosition: getBackgroundPosition(),
            backgroundSize: '300% 100%' // Assuming 3 frames horizontally
          }}
        />
      </div>

      {/* State indicator (optional visual hint) */}
      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white
        ${state === 'idle' ? 'bg-gray-400' : state === 'working' ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}
      `}/>
    </div>
  );
};
