import React, { useEffect, useState } from 'react';

type SpeechBubbleProps = {
  message: string;
  type?: 'support' | 'attack' | 'normal';
  onComplete?: () => void;
  // Use absolute positioning over the agent
  style?: React.CSSProperties;
};

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ message, type = 'normal', onComplete, style }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-hide the bubble after a short duration (star-office style transient messages)
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 300); // Wait for fade out animation
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-[120%] 
        ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        transition-all duration-300 ease-in-out`}
      style={style}
    >
      <div
        className={`px-3 py-1.5 rounded-2xl text-sm font-bold shadow-lg border-2 whitespace-nowrap
          ${type === 'support' ? 'bg-green-100 text-green-800 border-green-300' : 
            type === 'attack' ? 'bg-red-100 text-red-800 border-red-300' : 
            'bg-white text-gray-800 border-gray-200'}`}
      >
        {message}
      </div>
      {/* Little triangle pointing down */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white"
        style={{
          borderTopColor: type === 'support' ? '#bbf7d0' : type === 'attack' ? '#fecaca' : '#ffffff'
        }}
      />
    </div>
  );
};
