'use client';

interface EnemyPreviewProps {
  text: string;
  enemyPosition: number;
  enemyName: string;
}

export default function EnemyPreview({ text, enemyPosition, enemyName }: EnemyPreviewProps) {
  const renderText = () => {
    return text.split('').map((char, index) => {
      let className = 'text-gray-600';

      if (index < enemyPosition) {
        className = 'text-orange-400';
      } else if (index === enemyPosition) {
        className = 'text-orange-300 bg-orange-900/30';
      }

      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></div>
        <span className="text-sm font-medium text-orange-400">Enemy - {enemyName}</span>
        <span className="text-xs text-gray-500 ml-auto">
          {Math.round((enemyPosition / text.length) * 100)}%
        </span>
      </div>
      <div className="text-xs font-mono leading-relaxed whitespace-pre-wrap">
        {renderText()}
      </div>
    </div>
  );
}
