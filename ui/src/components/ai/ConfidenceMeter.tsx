import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface ConfidenceMeterProps {
  confidence: number;
}

export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const getConfidenceLevel = (conf: number) => {
    if (conf >= 80) return { label: 'Very High', color: 'text-green-600', bg: 'bg-green-500' };
    if (conf >= 70) return { label: 'High', color: 'text-green-600', bg: 'bg-green-500' };
    if (conf >= 60) return { label: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-500' };
    if (conf >= 50) return { label: 'Low', color: 'text-orange-600', bg: 'bg-orange-500' };
    return { label: 'Very Low', color: 'text-red-600', bg: 'bg-red-500' };
  };

  const level = getConfidenceLevel(confidence);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Confidence Level</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-1">Understanding Confidence</p>
                <p className="text-sm mb-2">
                  Confidence indicates the AI's certainty about this signal (0-100%).
                </p>
                <div className="space-y-1 text-xs">
                  <p>• <strong>80-100%:</strong> Very High - Strong conviction</p>
                  <p>• <strong>70-79%:</strong> High - Good confidence</p>
                  <p>• <strong>60-69%:</strong> Moderate - Reasonable signal</p>
                  <p>• <strong>50-59%:</strong> Low - Weak signal</p>
                  <p>• <strong>0-49%:</strong> Very Low - Uncertain</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${level.color}`}>{level.label}</span>
          <span className="text-2xl font-bold">{confidence.toFixed(1)}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="w-full bg-secondary rounded-full h-4 overflow-hidden shadow-inner">
          <div
            className={`${level.bg} h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden`}
            style={{ width: `${confidence}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>
        
        {/* Markers */}
        <div className="absolute -top-6 w-full flex justify-between text-xs text-muted-foreground px-1">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Visual indicator segments */}
      <div className="grid grid-cols-5 gap-1 mt-2">
        {[0, 1, 2, 3, 4].map((segment) => {
          const threshold = segment * 20;
          const isActive = confidence > threshold;
          return (
            <div
              key={segment}
              className={`h-2 rounded-full transition-all duration-300 ${
                isActive
                  ? segment >= 4
                    ? 'bg-green-500'
                    : segment >= 3
                    ? 'bg-green-400'
                    : segment >= 2
                    ? 'bg-yellow-500'
                    : segment >= 1
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                  : 'bg-secondary'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

