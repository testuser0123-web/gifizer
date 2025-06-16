'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

export type ProgressStep = 
  | 'converting' 
  | 'uploading-imgur'
  | 'completed'
  | 'error';

interface ProgressIndicatorProps {
  step: ProgressStep;
  progress: number; // 0-100
  message?: string;
  error?: string;
}

const STEP_MESSAGES = {
  converting: 'GIFに変換中...',
  'uploading-imgur': 'Imgurにアップロード中...',
  completed: '変換が完了しました！',
  error: 'エラーが発生しました'
};

const STEP_ORDER = ['converting', 'uploading-imgur', 'completed'];

export function ProgressIndicator({ step, progress, message, error }: ProgressIndicatorProps) {
  const currentStepIndex = STEP_ORDER.indexOf(step);
  
  if (step === 'error') {
    return (
      <div className="card p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-error text-2xl" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-error mb-2">
              {STEP_MESSAGES.error}
            </h3>
            <p className="text-sm text-secondary">
              {error || message || '不明なエラーが発生しました'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="space-y-6">
        {/* Progress Steps */}
        <div className="space-y-4">
          {STEP_ORDER.slice(0, -1).map((stepName, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            
            return (
              <div key={stepName} className="flex items-center gap-4">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${isCompleted ? 'bg-success text-white' : 
                    isActive ? 'bg-primary text-white' : 
                    'bg-muted text-secondary'}
                `}>
                  {isCompleted ? (
                    <FontAwesomeIcon icon={faCheck} className="text-sm" />
                  ) : isActive ? (
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sm" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    isActive ? 'text-foreground' : 
                    isCompleted ? 'text-success' : 
                    'text-secondary'
                  }`}>
                    {STEP_MESSAGES[stepName as keyof typeof STEP_MESSAGES]}
                  </p>
                  
                  {isActive && (
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-secondary mt-1">
                        {progress}% 完了
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Current Message */}
        {message && (
          <div className="text-center">
            <p className="text-sm text-secondary">{message}</p>
          </div>
        )}

        {/* Completion State */}
        {step === 'completed' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <FontAwesomeIcon icon={faCheck} className="text-success text-2xl" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-success mb-2">
                {STEP_MESSAGES.completed}
              </h3>
              <p className="text-sm text-secondary">
                GIFの変換とアップロードが正常に完了しました
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}