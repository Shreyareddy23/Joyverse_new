import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

interface ChildData {
  username: string;
  therapistCode: string;
  sessionId: string;
}

const LETTERS = ['A', 'B', 'C', 'D'];

const LetterTracing: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLetter, setCurrentLetter] = useState<string>('A');
  const [childData, setChildData] = useState<ChildData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [traceCount, setTraceCount] = useState(0);
  const [traceProgress, setTraceProgress] = useState(0);
  const navigate = useNavigate();

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate responsive canvas size based on window
    const maxWidth = Math.min(window.innerWidth * 0.85, 700);
    const maxHeight = Math.min(window.innerHeight * 0.5, 600);
    const canvasSize = Math.min(maxWidth, maxHeight, 500);
    
    // Set canvas size (internal resolution)
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Set CSS size (display size)
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    // Clear canvas and set cream background (easier on eyes)
    ctx.fillStyle = '#FFFEF7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate font size based on canvas size (65% for better visibility)
    const fontSize = Math.floor(canvasSize * 0.65);

    // Draw thick, highly visible letter outline for dyslexic children
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw light blue fill (very visible but not overwhelming)
    ctx.fillStyle = '#93C5FD';
    ctx.globalAlpha = 0.35;
    ctx.fillText(currentLetter, canvas.width / 2, canvas.height / 2);

    // Draw thick blue outline for tracing guide
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = Math.max(20, Math.floor(canvasSize / 25)); // Much thicker outline
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeText(currentLetter, canvas.width / 2, canvas.height / 2);

    // Add directional arrow (start indicator)
    ctx.fillStyle = '#2563EB';
    ctx.font = `bold ${Math.floor(canvasSize * 0.05)}px Arial`;
    ctx.fillText('Start here ➜', canvasSize * 0.15, canvasSize * 0.15);

    // Reset progress when canvas is reinitialized
    setTraceProgress(0);
  }, [currentLetter]);

  useEffect(() => {
    const stored = sessionStorage.getItem('childData');
    if (!stored) {
      navigate('/child-login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setChildData(parsed);
    } catch (err) {
      navigate('/child-login');
    }
  }, [navigate]);

  useEffect(() => {
    if (childData && currentLetter) {
      const timer = setTimeout(() => {
        initializeCanvas();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentLetter, childData, initializeCanvas]);

  useEffect(() => {
    const handleResize = () => {
      if (childData && currentLetter) {
        initializeCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [childData, currentLetter, initializeCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);

    // Use bright green for drawing (positive reinforcement)
    ctx.strokeStyle = '#10B981';
    // Thicker brush for easier control
    const brushSize = Math.max(18, Math.floor(canvas.width / 35));
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x, y);
    ctx.stroke();

    // Update progress as child traces
    const newProgress = Math.min(traceProgress + 0.8, 100);
    setTraceProgress(newProgress);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    initializeCanvas();
    setMessage(null);
  };

  const handleSave = async () => {
    if (!childData) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setMessage(null);

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setMessage('Failed to get canvas context');
        setLoading(false);
        return;
      }

      // More forgiving validation - check for green tracing
      const imageData_check = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hasDrawing = false;
      let greenPixelCount = 0;
      
      for (let i = 0; i < imageData_check.data.length; i += 4) {
        const r = imageData_check.data[i];
        const g = imageData_check.data[i + 1];
        const b = imageData_check.data[i + 2];
        // Check for green tracing (10B981 = RGB 16, 185, 129)
        if (g > 150 && r < 100 && b > 100) {
          greenPixelCount++;
        }
      }
      
      // Reduced threshold - only 30% completion needed (more forgiving)
      hasDrawing = greenPixelCount > 300;

      if (!hasDrawing) {
        setMessage('Keep going! Trace a bit more over the letter 😊');
        setLoading(false);
        return;
      }

      const canvasSize = canvas.width;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasSize;
      tempCanvas.height = canvasSize;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        setMessage('Failed to create image');
        setLoading(false);
        return;
      }

      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);
      
      const imageData = tempCanvas.toDataURL('image/png', 1.0);

      const response = await fetch('http://localhost:5000/api/tracing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapistCode: childData.therapistCode,
          username: childData.username,
          sessionId: childData.sessionId,
          letter: currentLetter,
          imageData: imageData,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTraceCount(traceCount + 1);
        setMessage(`🎉 Amazing job tracing ${currentLetter}! You're doing great!`);
        
        setTimeout(() => {
          const currentIndex = LETTERS.indexOf(currentLetter);
          if (currentIndex < LETTERS.length - 1) {
            setCurrentLetter(LETTERS[currentIndex + 1]);
            setMessage(null);
          } else {
            setMessage('🌟 WOW! You traced all the letters! Super star! 🌟');
            (async () => {
              try {
                await fetch('http://localhost:5000/api/mark-game-completed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    therapistCode: childData.therapistCode,
                    username: childData.username,
                    game: 'tracing'
                  })
                });
              } catch (err) {
                console.error('Failed to mark tracing game as completed:', err);
              }
            })();
            setTimeout(() => {
              navigate('/child-dashboard');
            }, 3000);
          }
        }, 2000);
      } else {
        setMessage(result.error || 'Failed to save tracing');
      }
    } catch (err: any) {
      setMessage('Network error while saving');
      console.error('Error saving tracing:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!childData) return <Container>Loading...</Container>;

  const currentIndex = LETTERS.indexOf(currentLetter);
  const progress = ((currentIndex + 1) / LETTERS.length) * 100;

  return (
    <Container>
      <Card>
        <CloseButton
          onClick={() => navigate('/child-dashboard')}
          title="Exit"
        >
          ×
        </CloseButton>
        <Header>
          <Title>✏️ Letter Tracing Game</Title>
          <Subtitle>Trace the letter <LetterHighlight>{currentLetter}</LetterHighlight></Subtitle>
        </Header>

        <ProgressBar>
          <ProgressFill progress={progress} />
        </ProgressBar>
        <ProgressText>
          Letter {currentIndex + 1} of {LETTERS.length}
        </ProgressText>

        <TraceProgressBar>
          <TraceProgressFill progress={traceProgress} />
        </TraceProgressBar>
        <TraceProgressText>
          {traceProgress < 30 ? "Keep tracing! 👍" : traceProgress < 70 ? "You're doing great! 🌟" : "Almost done! 🎉"}
        </TraceProgressText>

        <CanvasContainer>
          <Canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </CanvasContainer>

        {message && (
          <FeedbackMessage correct={message.includes('🎉') || message.includes('🌟') || message.includes('Amazing')}>
            {message}
          </FeedbackMessage>
        )}

        <ButtonContainer>
          <ClearButton onClick={handleClear} disabled={loading}>
            🔄 Try Again
          </ClearButton>
          <SaveButton onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : '✓ Done! Next →'}
          </SaveButton>
        </ButtonContainer>

        <InfoBox>
          💡 <strong>Tips:</strong> Follow the blue outline. Take your time - there's no rush! You can trace as many times as you want.
        </InfoBox>
      </Card>
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  padding: 32px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 700px;
  text-align: center;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  background: #ff6b6b;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 26px rgba(0,0,0,0.14);
  }
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h2`
  margin: 0 0 12px 0;
  font-size: 32px;
  color: #333;
  font-weight: bold;
`;

const Subtitle = styled.p`
  color: #666;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
`;

const LetterHighlight = styled.span`
  color: #3B82F6;
  font-size: 28px;
  font-weight: bold;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  width: ${props => props.progress}%;
  transition: width 0.5s ease;
`;

const ProgressText = styled.div`
  color: #666;
  font-size: 16px;
  margin-bottom: 16px;
  font-weight: 600;
`;

const TraceProgressBar = styled.div`
  width: 100%;
  height: 10px;
  background: #e8f5e9;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 6px;
  border: 2px solid #10B981;
`;

const TraceProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #10B981, #059669);
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

const TraceProgressText = styled.div`
  color: #059669;
  font-size: 16px;
  margin-bottom: 20px;
  font-weight: 700;
`;

const CanvasContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 24px 0;
  padding: 20px;
  background: #FFFEF7;
  border-radius: 16px;
  border: 3px solid #3B82F6;
  width: 100%;
  min-height: 450px;
`;

const Canvas = styled.canvas`
  border: 3px solid #93C5FD;
  border-radius: 12px;
  cursor: crosshair;
  background: #FFFEF7;
  touch-action: none;
  max-width: 100%;
  height: auto;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 24px;
`;

const ClearButton = styled.button`
  padding: 16px 28px;
  background: #FF9800;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(255, 152, 0, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SaveButton = styled.button`
  padding: 16px 28px;
  background: linear-gradient(135deg, #10B981, #059669);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FeedbackMessage = styled.div<{ correct: boolean }>`
  padding: 16px 24px;
  margin: 20px 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 18px;
  background: ${props => props.correct ? '#D1FAE5' : '#FEF3C7'};
  color: ${props => props.correct ? '#065F46' : '#92400E'};
  border: 2px solid ${props => props.correct ? '#10B981' : '#F59E0B'};
  animation: slideIn 0.4s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const InfoBox = styled.div`
  background: #DBEAFE;
  color: #1E40AF;
  padding: 16px;
  border-radius: 12px;
  font-size: 15px;
  margin-top: 24px;
  line-height: 1.6;
  border: 2px solid #3B82F6;
  text-align: left;
`;

export default LetterTracing;