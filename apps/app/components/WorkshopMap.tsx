import React from 'react';
import { mapZones } from '../constants/mapPositions';
import { MeerkatAgent, AnimState } from './MeerkatAgent';

export type AgentData = {
  id: string;
  role: string;
  state: AnimState;
  areaId: string;
  bubble: { message: string, type: 'support'|'attack'|'normal' } | null;
};

type WorkshopMapProps = {
  agents: AgentData[];
  onBubbleComplete: (agentId: string) => void;
  className?: string;
};

export const WorkshopMap: React.FC<WorkshopMapProps> = ({ agents, onBubbleComplete, className }) => {
  return (
    <div className={`relative w-full h-full min-h-[300px] rounded-xl overflow-hidden shadow-2xl border-4 border-amber-800 bg-amber-50 ${className ?? ''}`}>
      
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 bg-no-repeat bg-cover bg-center"
        style={{ backgroundImage: "url('/bg.png')" }}
      />
      
      {/* Area Labels Layer (Optional, for context) */}
      {Object.values(mapZones).map((zone) => (
        <div 
          key={`label-${zone.id}`}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ top: zone.x, left: zone.y }}
        >
          <div className="bg-black/55 text-white text-[10px] px-2 py-0.5 rounded-md whitespace-nowrap">
            {zone.name}
          </div>
        </div>
      ))}

      {/* Agents Layer */}
      {agents.map((agent) => {
        const position = mapZones[agent.areaId];
        if (!position) return null;

        return (
          <MeerkatAgent
            key={agent.id}
            id={agent.id}
            name={agent.role}
            state={agent.state}
            position={{ x: position.agentX, y: position.agentY }}
            currentBubble={agent.bubble}
            onBubbleComplete={() => onBubbleComplete(agent.id)}
          />
        );
      })}

    </div>
  );
};
