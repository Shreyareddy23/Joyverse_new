import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

const TOTAL_WORDS = 15; // Increased for better adaptation
const HESITATION_THRESHOLD = 3000; // 3 seconds without typing = hesitation

const TypingGame: React.FC = () => {
  const [currentWord, setCurrentWord] = useState('');
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Array<{ 
    word: string; 
    input: string; 
    correct: boolean;
    timeSpent: number;
    hesitations: number;
  }>>([]);
  const [wordCount, setWordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [childData, setChildData] = useState<{ username: string; therapistCode: string; sessionId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [savingOnClose, setSavingOnClose] = useState(false);
  
  // New AI features state
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [realtimeFeedback, setRealtimeFeedback] = useState<string | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [typingSpeed, setTypingSpeed] = useState<number[]>([]);
  const [accuracyTrend, setAccuracyTrend] = useState<number[]>([]);
  const [frustrationLevel, setFrustrationLevel] = useState(0);
  const [celebrationMode, setCelebrationMode] = useState(false);
  
  // Timing tracking
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastKeystroke, setLastKeystroke] = useState<number>(Date.now());
  const [hesitationCount, setHesitationCount] = useState(0);
  const hesitationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('childData');
    if (!stored) {
      navigate('/child-login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setChildData(parsed);

      const pref = sessionStorage.getItem(`selectedGame_${parsed.username}`) || sessionStorage.getItem('selectedGame');
      if (pref === 'puzzles') {
        navigate('/child-dashboard');
        return;
      }

      generateInitialWord(parsed);
    } catch (err) {
      navigate('/child-login');
    }
  }, [navigate]);

  // Hesitation detection
  useEffect(() => {
    if (input.length > 0 && !loading && !isGeneratingWord) {
      hesitationTimerRef.current = setTimeout(() => {
        setHesitationCount(prev => prev + 1);
        setFrustrationLevel(prev => Math.min(prev + 1, 5));
        showEncouragement('pause');
      }, HESITATION_THRESHOLD);
    }

    return () => {
      if (hesitationTimerRef.current) {
        clearTimeout(hesitationTimerRef.current);
      }
    };
  }, [input, lastKeystroke, loading, isGeneratingWord]);

  const generateInitialWord = async (data: { username: string; therapistCode: string; sessionId: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/typing/generate-initial-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: data.sessionId,
          username: data.username,
          therapistCode: data.therapistCode
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setCurrentWord(result.word);
        setStartTime(Date.now());
        setLoading(false);
        showWelcomeMessage();
      } else {
        throw new Error(result.error || 'Failed to generate word');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  const showWelcomeMessage = () => {
    setRealtimeFeedback('🌟 Let\'s start your typing adventure! Take your time and enjoy!');
    setTimeout(() => setRealtimeFeedback(null), 3000);
  };

  const showEncouragement = (type: 'pause' | 'struggle' | 'improvement' | 'milestone') => {
    const messages = {
      pause: [
        '💭 Take your time! There\'s no rush.',
        '🌈 You\'re doing great! Breathe and continue.',
        '⭐ Every letter counts! Keep going!'
      ],
      struggle: [
        '💪 You\'re learning! Every try makes you stronger!',
        '🎯 Practice makes progress! You\'ve got this!',
        '🌟 It\'s okay to make mistakes - that\'s how we learn!'
      ],
      improvement: [
        '🚀 Wow! You\'re getting faster!',
        '🎉 Amazing progress! Keep it up!',
        '⚡ You\'re on fire! Great typing!'
      ],
      milestone: [
        '🏆 Incredible! You\'re a typing champion!',
        '🎊 Halfway there! You\'re doing fantastic!',
        '🌟 Outstanding work! Keep shining!'
      ]
    };

    const selected = messages[type][Math.floor(Math.random() * messages[type].length)];
    setEncouragement(selected);
    setTimeout(() => setEncouragement(null), 3000);
  };

  const calculateDifficulty = (recentResults: typeof results) => {
    if (recentResults.length < 3) return 'medium';
    
    const last5 = recentResults.slice(-5);
    const accuracy = last5.filter(r => r.correct).length / last5.length;
    const avgTime = last5.reduce((sum, r) => sum + r.timeSpent, 0) / last5.length;
    const avgHesitations = last5.reduce((sum, r) => sum + r.hesitations, 0) / last5.length;

    // Adaptive difficulty logic
    if (accuracy >= 0.8 && avgTime < 5000 && avgHesitations < 2) {
      return 'hard';
    } else if (accuracy < 0.5 || avgHesitations > 3) {
      return 'easy';
    }
    return 'medium';
  };

  const generateAdaptiveFeedback = (wasCorrect: boolean, timeSpent: number, hesitations: number) => {
    if (wasCorrect) {
      if (timeSpent < 3000) {
        return '⚡ Lightning fast! You\'re amazing!';
      } else if (timeSpent < 6000) {
        return '🎯 Perfect! Great accuracy!';
      } else {
        return '✨ Well done! You got it right!';
      }
    } else {
      if (hesitations > 2) {
        return '💭 Take a breath! Let\'s try an easier one next.';
      } else {
        return '🌟 Almost there! Let\'s practice this pattern more.';
      }
    }
  };

  const generateNextWord = async () => {
    if (!childData) return;
    
    setIsGeneratingWord(true);
    setError(null);
    
    try {
      // Calculate adaptive difficulty
      const newDifficulty = calculateDifficulty(results);
      setDifficultyLevel(newDifficulty);

      const response = await fetch('http://localhost:5000/api/typing/generate-next-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: childData.sessionId,
          username: childData.username,
          therapistCode: childData.therapistCode,
          typingHistory: results,
          difficultyLevel: newDifficulty
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setCurrentWord(result.word);
        setStartTime(Date.now());
        setHesitationCount(0);
        setIsGeneratingWord(false);
        
        // Show difficulty adjustment message
        if (newDifficulty !== difficultyLevel) {
          const diffMessages = {
            easy: '🌱 Let\'s try something easier - you\'ve got this!',
            medium: '🎯 Perfect level for you! Let\'s go!',
            hard: '🚀 You\'re ready for a challenge! Amazing!'
          };
          setRealtimeFeedback(diffMessages[newDifficulty]);
          setTimeout(() => setRealtimeFeedback(null), 2500);
        }
      } else {
        throw new Error(result.error || 'Failed to generate word');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setIsGeneratingWord(false);
      const fallbackWords = ['cat', 'dog', 'sun', 'tree', 'book'];
      setCurrentWord(fallbackWords[Math.floor(Math.random() * fallbackWords.length)]);
      setStartTime(Date.now());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setLastKeystroke(Date.now());
    
    // Reset hesitation timer
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
    }
    
    // Reduce frustration on typing
    if (frustrationLevel > 0) {
      setFrustrationLevel(prev => Math.max(0, prev - 0.2));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentWord || input.trim() === '' || !startTime) return;

    const timeSpent = Date.now() - startTime;
    const correct = input.trim().toLowerCase() === currentWord.toLowerCase();
    const entry = { 
      word: currentWord, 
      input: input.trim(), 
      correct,
      timeSpent,
      hesitations: hesitationCount
    };
    
    const newResults = [...results, entry];
    setResults(newResults);
    
    // Update metrics
    setTypingSpeed([...typingSpeed, timeSpent]);
    const newAccuracy = newResults.filter(r => r.correct).length / newResults.length;
    setAccuracyTrend([...accuracyTrend, newAccuracy * 100]);
    
    setInput('');
    setWordCount(wordCount + 1);

    // Adaptive feedback
    const feedback = generateAdaptiveFeedback(correct, timeSpent, hesitationCount);
    setMessage(feedback);

    // Celebration for milestones
    if (wordCount + 1 === 5 || wordCount + 1 === 10) {
      showEncouragement('milestone');
      setCelebrationMode(true);
      setTimeout(() => setCelebrationMode(false), 2000);
    } else if (correct && timeSpent < 4000) {
      showEncouragement('improvement');
    } else if (!correct && hesitationCount > 2) {
      showEncouragement('struggle');
      setFrustrationLevel(prev => Math.min(prev + 1, 5));
    }

    // Auto-adjust if frustration is high
    if (frustrationLevel >= 4) {
      setRealtimeFeedback('💝 You\'re doing great! Let\'s take it slower.');
      setFrustrationLevel(0);
    }

    setTimeout(() => setMessage(null), 2000);

    if (wordCount + 1 >= TOTAL_WORDS) {
      await saveResults(newResults);
    } else {
      setTimeout(() => {
        generateNextWord();
      }, 2200);
    }
  };

  const saveResults = async (finalResults: typeof results) => {
    if (!childData) return;
    
    setLoading(true);
    try {
      const payload = {
        therapistCode: childData.therapistCode,
        username: childData.username,
        sessionId: childData.sessionId,
        results: finalResults
      };
      
      const resp = await fetch('http://localhost:5000/api/save-typing-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await resp.json();
      
      if (resp.ok) {
        setCelebrationMode(true);
        setMessage('🎉 Amazing! You completed all words! You\'re a typing star!');
        
        if (data.autoAnalysis) {
          setAnalysis(data.autoAnalysis);
        }
        
        try {
          await fetch('http://localhost:5000/api/mark-game-completed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              therapistCode: childData.therapistCode,
              username: childData.username,
              game: 'typing'
            })
          });
        } catch (err) {
          console.error('Failed to mark game as completed:', err);
        }
        
        setTimeout(() => {
          navigate('/child-dashboard');
        }, 3000);
      } else {
        setMessage(data.error || 'Failed to save results');
        setLoading(false);
      }
    } catch (err: any) {
      setMessage('Network error while saving results');
      setLoading(false);
    }
  };

  if (!childData) return <Container>Loading...</Container>;

  if (loading && wordCount === 0) {
    return (
      <Container>
        <Card>
          <LoadingSpinner>🔄</LoadingSpinner>
          <LoadingText>Preparing your personalized typing adventure...</LoadingText>
        </Card>
      </Container>
    );
  }

  return (
    <Container celebration={celebrationMode}>
      <Card celebration={celebrationMode}>
        <CloseButton
          title="Exit and save"
          aria-label="Exit and save"
          onClick={async () => {
            if (savingOnClose) return;
            setSavingOnClose(true);
            try {
              if (results && results.length > 0 && childData) {
                await fetch('http://localhost:5000/api/save-typing-results', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    therapistCode: childData.therapistCode,
                    username: childData.username,
                    sessionId: childData.sessionId,
                    results
                  })
                });
              }
            } catch (err) {
              console.error('Failed to save on close', err);
            } finally {
              setSavingOnClose(false);
              navigate('/child-dashboard');
            }
          }}
        >
          ×
        </CloseButton>

        <Header>
          <Title>⌨️ AI-Powered Typing Challenge!</Title>
          <DifficultyBadge level={difficultyLevel}>
            {difficultyLevel === 'easy' && '🌱 Easy Mode'}
            {difficultyLevel === 'medium' && '🎯 Medium Mode'}
            {difficultyLevel === 'hard' && '🚀 Challenge Mode'}
          </DifficultyBadge>
        </Header>

        {error && <ErrorMessage>⚠️ {error}</ErrorMessage>}

        {realtimeFeedback && (
          <RealtimeFeedback>{realtimeFeedback}</RealtimeFeedback>
        )}

        {encouragement && (
          <EncouragementBanner>{encouragement}</EncouragementBanner>
        )}

        <MetricsRow>
          <MetricCard>
            <MetricIcon>📊</MetricIcon>
            <MetricValue>
              {results.length > 0 
                ? Math.round((results.filter(r => r.correct).length / results.length) * 100)
                : 0}%
            </MetricValue>
            <MetricLabel>Accuracy</MetricLabel>
          </MetricCard>
          <MetricCard>
            <MetricIcon>⚡</MetricIcon>
            <MetricValue>
              {typingSpeed.length > 0
                ? Math.round(typingSpeed.reduce((a, b) => a + b, 0) / typingSpeed.length / 1000)
                : 0}s
            </MetricValue>
            <MetricLabel>Avg Speed</MetricLabel>
          </MetricCard>
          <MetricCard>
            <MetricIcon>🎯</MetricIcon>
            <MetricValue>{wordCount}/{TOTAL_WORDS}</MetricValue>
            <MetricLabel>Progress</MetricLabel>
          </MetricCard>
        </MetricsRow>

        <ProgressSection>
          <ProgressBar>
            <ProgressFill progress={(wordCount / TOTAL_WORDS) * 100} />
            <ProgressStars>
              {[...Array(5)].map((_, i) => (
                <Star key={i} filled={wordCount / TOTAL_WORDS >= (i + 1) / 5}>
                  ⭐
                </Star>
              ))}
            </ProgressStars>
          </ProgressBar>
        </ProgressSection>

        {isGeneratingWord ? (
          <WordBox>
            <LoadingSpinner>🔄</LoadingSpinner>
            <SmallLoadingText>Finding the perfect word for you...</SmallLoadingText>
          </WordBox>
        ) : (
          <>
            <WordDisplaySection>
              <WordLabel>📝 Type This Word:</WordLabel>
              <WordBox celebration={celebrationMode}>{currentWord}</WordBox>
            </WordDisplaySection>
            <Form onSubmit={handleSubmit}>
              <InputSection>
                <InputLabel>✏️ Your Turn:</InputLabel>
                <TextInput
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Start typing..."
                  autoFocus
                  disabled={loading || isGeneratingWord}
                  correct={input.trim().toLowerCase() === currentWord.toLowerCase() && input.trim() !== ''}
                />
                {input.trim() !== '' && (
                  <InputHint>
                    {input.trim().toLowerCase() === currentWord.toLowerCase() 
                      ? '✓ Perfect match! Hit submit!' 
                      : input.trim().length === currentWord.length 
                        ? '🔍 Check your spelling carefully!' 
                        : `📝 ${currentWord.length - input.trim().length} more letter${currentWord.length - input.trim().length !== 1 ? 's' : ''} to go!`}
                  </InputHint>
                )}
              </InputSection>
              <SubmitButton 
                type="submit" 
                disabled={loading || isGeneratingWord || input.trim() === ''}
              >
                🚀 Submit Word!
              </SubmitButton>
            </Form>
          </>
        )}

        {message && (
          <FeedbackMessage correct={message.includes('🎉') || message.includes('⚡') || message.includes('✨')}>
            {message}
          </FeedbackMessage>
        )}

        {results.length > 0 && (
          <ResultsSection>
            <ResultsTitle>⭐ Your Recent Performance:</ResultsTitle>
            
            {analysis?.problematicLetters && analysis.problematicLetters.length > 0 && (
              <ProblemLetters>
                🎯 Focus letters: {analysis.problematicLetters.slice(0, 5).join(', ').toUpperCase()}
              </ProblemLetters>
            )}

            <ResultsList>
              {results.slice(-5).reverse().map((r, idx) => (
                <ResultItem key={idx} correct={r.correct}>
                  <ResultIcon>{r.correct ? '✅' : '💪'}</ResultIcon>
                  <ResultWord>{r.word}</ResultWord>
                  <ResultTyped>→ {r.input}</ResultTyped>
                  <ResultTime>{(r.timeSpent / 1000).toFixed(1)}s</ResultTime>
                </ResultItem>
              ))}
            </ResultsList>
          </ResultsSection>
        )}
      </Card>
    </Container>
  );
};

// Animations
const celebrate = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

// Styled Components
const Container = styled.div<{ celebration?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${props => props.celebration 
    ? 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 50%, #ffeaa7 100%)'
    : 'linear-gradient(135deg, #fff8f0 0%, #ffeaa7 30%, #ffe5cc 70%, #fff8f0 100%)'};
  padding: 20px;
  transition: background 0.5s ease;
  animation: ${props => props.celebration ? shimmer : 'none'} 3s ease-in-out infinite;
  background-size: 2000px 100%;
`;

const Card = styled.div<{ celebration?: boolean }>`
  background: #fffef9;
  padding: 28px 24px;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 
              0 2px 8px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 700px;
  text-align: center;
  position: relative;
  border: 2px solid ${props => props.celebration ? '#fdcb6e' : 'rgba(255, 228, 181, 0.5)'};
  animation: ${props => props.celebration ? celebrate : 'none'} 0.6s ease;
`;

const Header = styled.div`
  margin-bottom: 20px;
`;

const Title = styled.h2`
  margin: 0 0 12px 0;
  font-size: 26px;
  color: #2c3e50;
  font-weight: 700;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', sans-serif;
`;

const DifficultyBadge = styled.div<{ level: string }>`
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: ${props => {
    if (props.level === 'easy') return 'linear-gradient(135deg, #a8e6cf, #81c784)';
    if (props.level === 'hard') return 'linear-gradient(135deg, #ff6b9d, #c44569)';
    return 'linear-gradient(135deg, #ffd93d, #f6c23e)';
  }};
  color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const RealtimeFeedback = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  animation: ${float} 2s ease-in-out infinite;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const EncouragementBanner = styled.div`
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  animation: ${celebrate} 0.8s ease;
  box-shadow: 0 4px 16px rgba(245, 87, 108, 0.4);
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const MetricsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
`;

const MetricCard = styled.div`
  background: linear-gradient(135deg, #f5f7fa 0%, #e3e9f0 100%);
  padding: 14px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border: 1px solid #d4dce6;
`;

const MetricIcon = styled.div`
  font-size: 24px;
  margin-bottom: 4px;
`;

const MetricValue = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 2px;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const MetricLabel = styled.div`
  font-size: 11px;
  color: #7f8c8d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const ProgressSection = styled.div`
  margin-bottom: 24px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 32px;
  background: #f5f5f5;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  border: 2px solid #e0e0e0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.08);
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #ffd54f 0%, #ffb74d 100%);
  width: ${props => props.progress}%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
`;

const ProgressStars = styled.div`
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: space-around;
  padding: 0 10px;
  z-index: 2;
`;

const Star = styled.span<{ filled: boolean }>`
  font-size: 18px;
  filter: ${props => props.filled ? 'none' : 'grayscale(1) brightness(1.5)'};
  transition: all 0.3s ease;
  transform: ${props => props.filled ? 'scale(1.2)' : 'scale(1)'};
`;

const WordDisplaySection = styled.div`
  margin: 24px 0;
`;

const WordLabel = styled.div`
  font-size: 14px;
  color: #34495e;
  font-weight: 600;
  margin-bottom: 10px;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const WordBox = styled.div<{ celebration?: boolean }>`
  font-size: 36px;
  font-weight: 700;
  padding: 28px 20px;
  margin: 0;
  background: ${props => props.celebration 
    ? 'linear-gradient(135deg, #ffeaa7, #fdcb6e)'
    : '#fffef9'};
  color: #1a237e;
  border-radius: 16px;
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 3px solid #ffd54f;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
  animation: ${props => props.celebration ? celebrate : 'none'} 0.6s ease;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
`;

const InputSection = styled.div`
  width: 100%;
  max-width: 500px;
`;

const InputLabel = styled.div`
  font-size: 14px;
  color: #34495e;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: left;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const TextInput = styled.input<{ correct?: boolean }>`
  padding: 16px 20px;
  border: 3px solid ${props => props.correct ? '#4caf50' : '#d0d0d0'};
  border-radius: 12px;
  width: 100%;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: #1a237e;
  letter-spacing: 3px;
  transition: all 0.3s ease;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;

  &:focus {
    outline: none;
    border-color: ${props => props.correct ? '#4caf50' : '#667eea'};
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3),
                0 0 0 4px ${props => props.correct ? 'rgba(76, 175, 80, 0.15)' : 'rgba(102, 126, 234, 0.15)'};
    transform: translateY(-2px);
  }

  &:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  &::placeholder {
    color: #95a5a6;
    font-weight: 400;
    letter-spacing: 1px;
  }
`;

const InputHint = styled.div`
  margin-top: 8px;
  font-size: 13px;
  color: #7f8c8d;
  text-align: center;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
  min-height: 20px;
`;

const SubmitButton = styled.button`
  padding: 14px 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  letter-spacing: 0.5px;
  min-width: 160px;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;

  &:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px) scale(1.02);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const FeedbackMessage = styled.div<{ correct: boolean }>`
  padding: 14px 20px;
  margin: 16px 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 15px;
  background: ${props => props.correct 
    ? 'linear-gradient(135deg, #d4edda, #a8e6cf)' 
    : 'linear-gradient(135deg, #fff3cd, #ffe5b4)'};
  color: ${props => props.correct ? '#155724' : '#856404'};
  border: 2px solid ${props => props.correct ? '#28a745' : '#ffc107'};
  animation: ${celebrate} 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const LoadingSpinner = styled.div`
  font-size: 64px;
  animation: spin 1s linear infinite;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: #34495e;
  margin-top: 16px;
  font-size: 15px;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const SmallLoadingText = styled.p`
  color: #1a237e;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const ErrorMessage = styled.div`
  background: #fff3cd;
  color: #856404;
  padding: 12px;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
  border: 2px solid #ffc107;
  box-shadow: 0 2px 6px rgba(255, 193, 7, 0.2);
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const ResultsSection = styled.div`
  margin-top: 24px;
  padding-top: 20px;
  border-top: 2px dashed #ddd;
`;

const ResultsTitle = styled.h3`
  font-size: 17px;
  color: #2c3e50;
  margin: 0 0 14px 0;
  font-weight: 700;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
`;

const ProblemLetters = styled.div`
  font-size: 14px;
  color: #c0392b;
  margin-bottom: 12px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffebee, #ffcdd2);
  padding: 12px 16px;
  border-radius: 10px;
  border: 2px solid #ef5350;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;
  box-shadow: 0 2px 8px rgba(239, 83, 80, 0.2);
`;

const ResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ResultItem = styled.div<{ correct: boolean }>`
  display: grid;
  grid-template-columns: 40px 1fr 1fr 60px;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: ${props => props.correct 
    ? 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' 
    : 'linear-gradient(135deg, #fff3e0, #ffe0b2)'};
  border-radius: 10px;
  font-size: 14px;
  border: 2px solid ${props => props.correct ? '#4caf50' : '#ff9800'};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  font-weight: 600;
  transition: all 0.2s ease;
  font-family: 'OpenDyslexic', 'Lexend', sans-serif;

  &:hover {
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }
`;

const ResultIcon = styled.span`
  font-size: 20px;
`;

const ResultWord = styled.span`
  font-weight: 700;
  color: #2c3e50;
  font-size: 15px;
  text-align: left;
`;

const ResultTyped = styled.span`
  color: #7f8c8d;
  font-style: italic;
  font-size: 14px;
  text-align: left;
`;

const ResultTime = styled.span`
  color: #34495e;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  background: rgba(255, 255, 255, 0.5);
  padding: 4px 8px;
  border-radius: 6px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(255, 107, 157, 0.4);
  transition: all 0.3s ease;
  font-weight: 900;
  border: 3px solid rgba(255, 255, 255, 0.5);

  &:hover { 
    transform: translateY(-3px) rotate(90deg) scale(1.1); 
    box-shadow: 0 10px 26px rgba(255, 107, 157, 0.6);
  }
  
  &:active {
    transform: translateY(-1px) rotate(90deg) scale(1.05);
  }
`;

export default TypingGame