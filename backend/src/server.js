import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import { customAlphabet } from 'nanoid';
import axios from 'axios';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

const generateNumericCode = customAlphabet('0123456789', 6);

// Get directory paths for static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS for all routes
app.use(cors());
// Serve static images from backend/images folder
app.use('/images', express.static(path.join(__dirname, '../images')));
// Increase payload size limit for audio files (50MB)
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is running!',
  });
});

// MongoDB connection (use 127.0.0.1 for compatibility)
mongoose.connect("mongodb://localhost:27017/joyverse", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Invitation Code Schema (New)
const invitationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  isUsed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  usedBy: { type: String, default: null },
  usedAt: { type: Date, default: null }
});
const Invitation = mongoose.model('Invitation', invitationSchema);

// Therapist Schema
const therapistSchema = new mongoose.Schema({

  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  code: { type: String, unique: true },
  children: [
    {
      username: String,
      joinedAt: { type: Date, default: Date.now },
      sessions: [
        {
          sessionId: String,
          date: { type: Date, default: Date.now },
          assignedThemes: [String],
          themesChanged: [String],
          emotionsOfChild: [String],
          playedPuzzles: [
            {
              theme: String,
              level: Number,
              puzzleId: String,
              completedAt: { type: Date, default: Date.now },
              emotionsDuring: [String],
            },
          ],
              typingResults: [
                {
                  word: String,
                  input: String,
                  correct: Boolean,
                  completedAt: { type: Date, default: Date.now }
                }
              ],
              typingResultsMap: { type: Object, default: {} },
              preferredGame: { type: String, default: null },
              assignedGames: { type: [String], default: [] },
              preferredStory: { type: String, default: null },
              readingRecordings: { type: Array, default: [] },
              tracingResults: [
                {
                  letter: String,
                  imageData: String,
                  tracedAt: { type: Date, default: Date.now }
                }
              ],
        },
      ],
      currentAssignedThemes: { type: [String], default: [] },
      assignedThemes: { type: [String], default: [] },
      playedPuzzles: { type: [String], default: [] },
      preferredGame: { type: String, default: null },
      assignedGames: { type: [String], default: [] },
      completedGames: { type: [String], default: [] },
      preferredStory: { type: String, default: null },
    },
  ],
});
const Therapist = mongoose.model('Therapist', therapistSchema);

// Child Schema (not directly used, but kept for completeness)
const childSchema = new mongoose.Schema({
  username: String,
  assignedThemes: { type: [String], default: [] },
  playedPuzzles: { type: [String], default: [] },
  joinedAt: { type: Date, default: Date.now }
});
const Child = mongoose.model('Child', childSchema);

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// FAQ Schema
const faqSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  question: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const FAQ = mongoose.model('FAQ', faqSchema);

const wordListSchema = new mongoose.Schema({
  theme: { type: String, required: true },
  level: { type: Number, required: true },
  words: [
    {
      word: { type: String, required: true },
      image: { type: String, required: true },
    },
  ],
});

const WordList = mongoose.model('WordList', wordListSchema);

// Story Schema
const storySchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, default: 'Unknown' },
  story: { type: String, required: true },
  moral: { type: String, required: true },
  image: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Story = mongoose.model('Story', storySchema);

// Generate unique 6-digit therapist code
const generateUniqueCode = async () => {
  let code;
  let exists = true;
  while (exists) {
    code = generateNumericCode();
    exists = await Therapist.findOne({ code });
  }
  return code;
};

// Generate a unique session ID
const generateSessionId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// API endpoint to create invitation codes (Admin only)
app.post('/api/create-invitation', async (req, res) => {
  try {
    const { adminKey } = req.body;
    
    // A secure admin key should be used in production
    if (adminKey !== 'admin-secret-key') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Use fixed invitation code 'joyversetherapist'
    const code = 'joyversetherapist';
    
    // Check if this code already exists
    const existingCode = await Invitation.findOne({ code });
    if (existingCode) {
      return res.status(400).json({ 
        message: 'Fixed invitation code already exists',
        code: code
      });
    }
    
    const newInvitation = new Invitation({ code });
    await newInvitation.save();
    
    res.status(201).json({ 
      message: 'Invitation code created successfully',
      code: newInvitation.code
    });
  } catch (error) {
    console.error('Error creating invitation code:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// API endpoint to list all invitation codes (Admin only)
app.get('/api/invitations', async (req, res) => {
  try {
    const { adminKey } = req.query;
    
    if (adminKey !== 'admin-secret-key') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const invitations = await Invitation.find();
    res.status(200).json(invitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Therapist Signup
app.post('/api/signup', async (req, res) => {
  console.log("Request body:", req.body);
  try {
    const { username, password, invitationCode } = req.body;

    // Check if the username already exists
    const existing = await Therapist.findOne({ username });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    // Validate the invitation code - accept both the fixed code and any existing valid codes
    const fixedCode = 'joyversetherapist';
    let invitation;

    if (invitationCode === fixedCode) {
      // Check if fixed code exists in database, if not create it
      invitation = await Invitation.findOne({ code: fixedCode });
      if (!invitation) {
        invitation = new Invitation({ code: fixedCode });
        await invitation.save();
      }
    } else {
      // Check for other valid invitation codes
      invitation = await Invitation.findOne({ code: invitationCode });
      if (!invitation) {
        return res.status(403).json({ message: 'Invalid invitation code' });
      }
      
      // Check if non-fixed invitation code has already been used
      if (invitation.code !== fixedCode && invitation.isUsed) {
        return res.status(403).json({ message: 'Invitation code has already been used' });
      }
    }

    // Generate therapist code
    const code = await generateUniqueCode();

    // Create therapist
    const newTherapist = new Therapist({ 
      username, 
      password, 
      code,
      invitationCodeUsed: invitationCode 
    });
    await newTherapist.save();

    // Mark invitation as used (note: fixed code can be used multiple times)
    if (invitation.code !== fixedCode) {
      invitation.isUsed = true;
    }
    invitation.usedBy = invitationCode === fixedCode ? `${invitation.usedBy || ''}${username}, ` : username;
    invitation.usedAt = new Date();
    await invitation.save();

    res.status(201).json({ message: 'Signup successful', username, code });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Therapist Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username, password });

    // Check if the user is a therapist
    const therapist = await Therapist.findOne({ username });
    if (therapist) {
      console.log('Therapist found:', therapist.username);
      const isPasswordValid = await bcrypt.compare(password, therapist.password);
      if (isPasswordValid) {
        console.log('Therapist login successful');
        return res.status(200).json({
          role: 'therapist',
          username: therapist.username,
          code: therapist.code,
        });
      } else {
        console.log('Invalid therapist password');
      }
    }

    // Check if the user is a child
    const therapistWithChild = await Therapist.findOne({
      "children.username": username,
    });

    if (therapistWithChild) {
      console.log('Therapist with child found:', therapistWithChild.username);
      const child = therapistWithChild.children.find(
        (child) => child.username === username
      );

      if (child) {
        console.log('Child found:', child.username);
        const sessionId = generateSessionId();
        child.sessions.push({
          sessionId,
          assignedThemes: child.currentAssignedThemes || [],
          themesChanged: [],
          emotionsOfChild: [],
          playedPuzzles: [],
          preferredStory: child.preferredStory || null,
        });

        await therapistWithChild.save();

        console.log('Child login successful');
        return res.status(200).json({
          role: 'child',
          username: child.username,
          therapistCode: therapistWithChild.code,
          assignedThemes: child.currentAssignedThemes || [],
          preferredGame: child.preferredGame || null,
          assignedGames: child.assignedGames || [],
          preferredStory: child.preferredStory || null,
          sessionId,
        });
      }
    }

    console.log('Invalid username or password');
    res.status(401).json({ message: 'Invalid username or password' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add Child
app.post('/api/add-child', async (req, res) => {
  try {
    const { therapistCode, childName } = req.body;

    if (!therapistCode || !childName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const therapist = await Therapist.findOne({ code: therapistCode });
    if (!therapist) return res.status(404).json({ message: 'Therapist not found' });

    const exists = therapist.children.find(child => child.username === childName);
    if (exists) return res.status(400).json({ message: 'Child already exists' });

    therapist.children.push({
      username: childName,
      currentAssignedThemes: [],
      assignedThemes: [], // For backward compatibility
      playedPuzzles: [],  // For backward compatibility
      preferredGame: null,
      assignedGames: [],
      completedGames: []
    });
    await therapist.save();

    res.status(200).json({ message: 'Child added successfully' });
  } catch (error) {
    console.error('Error adding child:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark a game as completed for a child
app.post('/api/mark-game-completed', async (req, res) => {
  try {
    const { therapistCode, username, game } = req.body;
    if (!therapistCode || !username || !game) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const therapist = await Therapist.findOne({ code: therapistCode });
    if (!therapist) return res.status(404).json({ error: 'Therapist not found' });

    const childIndex = therapist.children.findIndex(c => c.username === username);
    if (childIndex === -1) return res.status(404).json({ error: 'Child not found' });

    const child = therapist.children[childIndex];
    if (!child.completedGames) {
      child.completedGames = [];
    }

    // Add game to completedGames array if not already present
    if (!child.completedGames.includes(game)) {
      child.completedGames.push(game);
    }

    await therapist.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking game as completed:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Set preferred game for a child (supports both single game and array of games)
app.post('/api/set-preferred-game', async (req, res) => {
  try {
    const { therapistCode, username, preferredGame, assignedGames } = req.body;
    if (!therapistCode || !username) return res.status(400).json({ error: 'Missing fields' });

    // Find the therapist and child
    const therapist = await Therapist.findOne({ code: therapistCode });
    if (!therapist) return res.status(404).json({ error: 'Therapist not found' });

    const childIndex = therapist.children.findIndex(c => c.username === username);
    if (childIndex === -1) return res.status(404).json({ error: 'Child not found' });

    const child = therapist.children[childIndex];
    if (!child.assignedGames) {
      child.assignedGames = [];
    }

    // If assignedGames array is provided, replace the entire array
    if (assignedGames && Array.isArray(assignedGames)) {
      // Filter to only include valid game types
      const validGames = assignedGames.filter(g => 
        ['typing', 'puzzles', 'reading', 'tracing'].includes(g)
      );
      child.assignedGames = validGames;
      
      // Set preferredGame to the first game for backward compatibility
      child.preferredGame = validGames.length > 0 ? validGames[0] : null;
    } 
    // Otherwise, handle single game for backward compatibility
    else if (preferredGame) {
      // Add game to assignedGames array if not already present
      if (!child.assignedGames.includes(preferredGame)) {
        child.assignedGames.push(preferredGame);
      }
      // Also set preferredGame for backward compatibility
      child.preferredGame = preferredGame;
    }

    await therapist.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting preferred game:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// ==================== ENHANCED AI-POWERED TYPING GAME ENDPOINTS ====================

// Enhanced word bank with difficulty levels (3-5 letters, dyslexia-friendly)
const TYPING_WORDS = {
  easy: [
    'cat', 'dog', 'sun', 'bed', 'leg', 'pie', 'bee', 'sea', 'tea', 'pea', 
    'lip', 'lid', 'bib', 'did', 'dad', 'bad', 'pad', 'lad', 
    'bat', 'pat', 'tap', 'nap', 'pan', 'man', 'fan', 'van', 'jam', 'yam',
    'sip', 'lip', 'tip', 'dip', 'pip', 'rip', 'zip', 'mop', 'pop'
  ],
  
  medium: [
    'bell', 'dell', 'pill', 'bill', 'peel', 'deep', 'beep', 'peep', 'pipe', 'pale', 
    'bale', 'bail', 'pail', 'leap', 'deal', 
    'was', 'saw', 'no', 'on', 'top', 'pot', 'ten', 'net', 
    'thin', 'chin', 'ship', 'shop', 'cash', 'dash', 'wish', 'fish', 
    'mild', 'wild', 'kind', 'mind', 'bend', 'lend', 'send', 'tend'
  ],
  
  hard: [
    'pedal', 'piped', 'biped', 'belle', 'bleed', 'bled', 'idle', 'bide', 'pile', 'piled', 
    'deli', 'bead', 'lied', 'bile', 
    'dared', 'bread', 'brand', 'grand', 'blend', 'trend', 'flipped', 'dripped',
    'thick', 'think', 'thank', 'chunk', 'shrimp', 'crash', 'flash', 'splash', 
    'below', 'elbow', 'window', 'yellow', 'mirror', 'pillow', 'shadow', 'follow'
  ]  
};

// Flatten all words for backward compatibility
const ALL_TYPING_WORDS = [...TYPING_WORDS.easy, ...TYPING_WORDS.medium, ...TYPING_WORDS.hard]
  .filter((v, i, a) => a.indexOf(v) === i); // dedupe

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Enhanced problem letter scoring with weighted recent errors
function getProblemLetterScores(typingHistory) {
  const letterScores = {}; // targetLetter -> weighted error count
  const recentWeight = 2; // Recent errors count more
  const historyLength = typingHistory.length;
  
  typingHistory.forEach((item, index) => {
    const target = String(item.word || '').toLowerCase();
    const typed = String(item.input || '').toLowerCase();
    if (item.correct) return;
    
    // Calculate recency weight (more recent = higher weight)
    const weight = index >= historyLength - 3 ? recentWeight : 1;
    
    const maxLen = Math.max(target.length, typed.length);
    for (let i = 0; i < maxLen; i++) {
      const t = target[i] || '';
      const u = typed[i] || '';
      if (t !== u && t) {
        letterScores[t] = (letterScores[t] || 0) + weight;
      }
    }
  });
  return letterScores;
}

// NEW: Calculate adaptive difficulty based on performance metrics
function calculateAdaptiveDifficulty(typingHistory) {
  if (typingHistory.length < 3) return 'medium';
  
  const last5 = typingHistory.slice(-5);
  const accuracy = last5.filter(r => r.correct).length / last5.length;
  const avgTime = last5.reduce((sum, r) => sum + (r.timeSpent || 5000), 0) / last5.length;
  const avgHesitations = last5.reduce((sum, r) => sum + (r.hesitations || 0), 0) / last5.length;
  
  // Smart difficulty adjustment logic
  if (accuracy >= 0.8 && avgTime < 5000 && avgHesitations < 2) {
    return 'hard'; // Child is doing great, challenge them
  } else if (accuracy < 0.5 || avgHesitations > 3 || avgTime > 8000) {
    return 'easy'; // Child is struggling, make it easier
  }
  return 'medium'; // Balanced performance
}

// NEW: Enhanced word selection with difficulty and problem letter targeting
function chooseNextWordWithDifficulty(typingHistory, usedWords, requestedDifficulty) {
  const used = new Set((usedWords || []).map(w => String(w).toLowerCase()));
  const scores = getProblemLetterScores(typingHistory || []);
  
  // Determine actual difficulty (use adaptive if not specified)
  const difficulty = requestedDifficulty || calculateAdaptiveDifficulty(typingHistory);
  
  // Get candidate words by difficulty
  let candidates = TYPING_WORDS[difficulty].filter(w => !used.has(w));
  
  // Fallback to all words if difficulty level exhausted
  if (candidates.length === 0) {
    candidates = ALL_TYPING_WORDS.filter(w => !used.has(w));
  }
  
  // Ultimate fallback
  if (candidates.length === 0) {
    return pickRandom(ALL_TYPING_WORDS);
  }
  
  // Focus on problem letters if any identified
  const focusLetters = Object.keys(scores).sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
  
  if (focusLetters.length > 0) {
    // Try to find words containing top problem letters
    for (const letter of focusLetters.slice(0, 3)) { // Check top 3 problem letters
      const subset = candidates.filter(w => w.includes(letter));
      if (subset.length > 0) {
        console.log(`🎯 Targeting problem letter: ${letter}`);
        return pickRandom(subset);
      }
    }
  }
  
  return pickRandom(candidates);
}

// NEW: Enhanced analysis with emotional support recommendations
function analyzeResultsLocally(results) {
  const all = results || [];
  const totalWords = all.length;
  const correctWords = all.filter(r => !!r.correct).length;
  const overallAccuracy = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

  const letterErrorCounts = {};
  const letterOkCounts = {};
  const confusionMap = {}; // { target: { mistakenAs: count } }
  
  // Performance metrics
  const avgTimeSpent = all.length > 0 
    ? all.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / all.length 
    : 0;
  const totalHesitations = all.reduce((sum, r) => sum + (r.hesitations || 0), 0);
  const avgHesitations = all.length > 0 ? totalHesitations / all.length : 0;

  all.forEach(item => {
    const target = String(item.word || '').toLowerCase();
    const typed = String(item.input || '').toLowerCase();
    const maxLen = Math.max(target.length, typed.length);
    
    for (let i = 0; i < maxLen; i++) {
      const t = target[i] || '';
      const u = typed[i] || '';
      if (!t) continue;
      
      if (t === u) {
        letterOkCounts[t] = (letterOkCounts[t] || 0) + 1;
      } else {
        letterErrorCounts[t] = (letterErrorCounts[t] || 0) + 1;
        if (u) {
          confusionMap[t] = confusionMap[t] || {};
          confusionMap[t][u] = (confusionMap[t][u] || 0) + 1;
        }
      }
    }
  });

  const problematicLetters = Object.keys(letterErrorCounts)
    .sort((a, b) => (letterErrorCounts[b] || 0) - (letterErrorCounts[a] || 0));

  const strengths = Object.keys(letterOkCounts)
    .filter(l => (letterOkCounts[l] || 0) >= (letterErrorCounts[l] || 0))
    .sort((a, b) => (letterOkCounts[b] || 0) - (letterOkCounts[a] || 0));

  const confusionPatterns = [];
  Object.keys(confusionMap).forEach(target => {
    const mistakenAs = Object.entries(confusionMap[target])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    mistakenAs.forEach(([withLetter]) => {
      if (withLetter && withLetter !== target) {
        confusionPatterns.push({ 
          confuses: withLetter, 
          with: target,
          frequency: confusionMap[target][withLetter]
        });
      }
    });
  });

  // Determine severity and emotional state
  let severity = 'mild';
  let emotionalState = 'confident';
  
  if (overallAccuracy < 60) {
    severity = 'severe';
    emotionalState = 'struggling';
  } else if (overallAccuracy < 80) {
    severity = 'moderate';
    emotionalState = 'challenged';
  } else if (overallAccuracy >= 90) {
    emotionalState = 'excelling';
  }
  
  // Check for frustration indicators
  if (avgHesitations > 2.5 || avgTimeSpent > 7000) {
    emotionalState = 'frustrated';
  }

  // Generate personalized recommendations
  const recommendations = [];
  
  if (problematicLetters.length > 0) {
    const topLetters = problematicLetters.slice(0, 5).join(', ').toUpperCase();
    recommendations.push(`🎯 Focus practice on these letters: ${topLetters}`);
  }
  
  if (confusionPatterns.length > 0) {
    const topPairs = confusionPatterns.slice(0, 3)
      .map(p => `${p.confuses}/${p.with}`)
      .join(', ')
      .toUpperCase();
    recommendations.push(`🔄 Work on distinguishing: ${topPairs}`);
  }
  
  if (avgHesitations > 2) {
    recommendations.push('⏸️ Use visual letter cards to reduce hesitation');
    recommendations.push('💝 Practice in shorter, more frequent sessions');
  }
  
  if (overallAccuracy >= 90) {
    recommendations.push('🌟 Excellent progress! Ready for more challenging words');
  } else if (overallAccuracy < 70) {
    recommendations.push('🌱 Start with simpler 3-letter words for confidence');
    recommendations.push('👁️ Use multisensory techniques (trace letters while saying them)');
  }
  
  if (avgTimeSpent > 7000) {
    recommendations.push('🐢 Take time to sound out each letter - no rush!');
  } else if (avgTimeSpent < 3000) {
    recommendations.push('⚡ Great speed! Focus on accuracy next');
  }

  // Performance trends
  const last5 = all.slice(-5);
  const recentAccuracy = last5.length > 0 
    ? (last5.filter(r => r.correct).length / last5.length) * 100 
    : 0;
  const isImproving = recentAccuracy > overallAccuracy;

  return {
    problematicLetters,
    confusionPatterns,
    strengths,
    overallAccuracy,
    recommendations,
    severity,
    emotionalState,
    performanceMetrics: {
      avgTimeSpent: Math.round(avgTimeSpent),
      totalHesitations,
      avgHesitations: avgHesitations.toFixed(1),
      isImproving,
      recentAccuracy: Math.round(recentAccuracy)
    },
    encouragement: getEncouragementMessage(emotionalState, overallAccuracy)
  };
}

// NEW: Generate contextual encouragement messages
function getEncouragementMessage(emotionalState, accuracy) {
  const messages = {
    excelling: [
      "🌟 Outstanding work! You're a typing superstar!",
      "🚀 Incredible progress! Keep up the amazing effort!",
      "🏆 You're mastering these letters beautifully!"
    ],
    confident: [
      "💪 Great job! You're doing really well!",
      "⭐ Nice progress! Keep practicing!",
      "🎯 You're on the right track!"
    ],
    challenged: [
      "🌈 You're learning and improving every day!",
      "💝 Keep going! Every practice helps!",
      "🌱 You're making steady progress!"
    ],
    struggling: [
      "💙 Learning takes time - you're doing great!",
      "🌟 Every attempt makes you stronger!",
      "🤗 It's okay to find this challenging - keep trying!"
    ],
    frustrated: [
      "💝 Take a break if needed - you're doing your best!",
      "🌈 Remember, progress isn't always linear!",
      "🫂 You're working hard, and that's what matters!"
    ]
  };
  
  const stateMessages = messages[emotionalState] || messages.confident;
  return stateMessages[Math.floor(Math.random() * stateMessages.length)];
}

// ========== ENHANCED TYPING ENDPOINTS ==========

// 1. Generate initial word with difficulty awareness
app.post('/api/typing/generate-initial-word', async (req, res) => {
  try {
    const { sessionId, username, therapistCode } = req.body;
    
    if (!sessionId || !username || !therapistCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Start with medium difficulty word
    const word = pickRandom(TYPING_WORDS.medium);
    console.log('✨ Generated initial word (AI-Enhanced):', word);
    
    res.json({ 
      success: true, 
      word, 
      isInitial: true,
      difficulty: 'medium',
      message: 'Welcome! Let\'s start your typing adventure!'
    });
  } catch (error) {
    console.error('Error generating initial word:', error);
    res.status(500).json({ 
      error: 'Failed to generate word', 
      details: error.message 
    });
  }
});

// 2. Generate adaptive next word based on performance
app.post('/api/typing/generate-next-word', async (req, res) => {
  try {
    const { sessionId, username, therapistCode, typingHistory, difficultyLevel } = req.body;
    
    if (!sessionId || !username || !therapistCode || !typingHistory) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate adaptive difficulty
    const adaptiveDifficulty = difficultyLevel || calculateAdaptiveDifficulty(typingHistory);
    
    // Get used words to avoid repetition
    const usedWords = typingHistory.map(item => String(item.word || '').toLowerCase());
    
    // Select next word with AI targeting
    const word = chooseNextWordWithDifficulty(typingHistory, usedWords, adaptiveDifficulty);
    
    // Analyze recent performance for feedback
    const recentResults = typingHistory.slice(-3);
    const recentAccuracy = recentResults.length > 0
      ? (recentResults.filter(r => r.correct).length / recentResults.length) * 100
      : 0;
    
    console.log(`🧠 AI Word Selection: "${word}" (${adaptiveDifficulty}) | Recent accuracy: ${recentAccuracy.toFixed(0)}%`);
    
    res.json({ 
      success: true, 
      word, 
      isAdaptive: true,
      difficulty: adaptiveDifficulty,
      recentAccuracy: Math.round(recentAccuracy),
      aiInsight: recentAccuracy < 60 
        ? 'Selected easier word to build confidence'
        : recentAccuracy > 85
        ? 'Selected challenging word to advance skills'
        : 'Selected balanced word for steady progress'
    });
  } catch (error) {
    console.error('Error generating next word:', error);
    res.status(500).json({ 
      error: 'Failed to generate word', 
      details: error.message 
    });
  }
});

// 3. Enhanced analysis with AI insights
app.post('/api/typing/analyze-session', async (req, res) => {
  try {
    const { sessionId, username, therapistCode } = req.body;
    
    if (!sessionId || !username || !therapistCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const therapist = await Therapist.findOne({
      code: therapistCode,
      'children.username': username,
      'children.sessions.sessionId': sessionId
    });

    if (!therapist) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const child = therapist.children.find(c => c.username === username);
    const session = child.sessions.find(s => s.sessionId === sessionId);

    if (!session.typingResults || session.typingResults.length === 0) {
      return res.status(400).json({ error: 'No typing results to analyze' });
    }

    // Enhanced AI analysis
    const analysis = analyzeResultsLocally(session.typingResults);
    
    session.typingAnalysis = {
      ...analysis,
      analyzedAt: new Date(),
      totalWords: session.typingResults.length,
      correctWords: session.typingResults.filter(r => r.correct).length,
      aiPowered: true
    };

    await therapist.save();

    console.log('🧠 AI Analysis completed for session:', sessionId);
    console.log('📊 Emotional State:', analysis.emotionalState);
    console.log('🎯 Problem Letters:', analysis.problematicLetters.join(', '));

    res.json({ 
      success: true, 
      analysis: session.typingAnalysis,
      message: 'AI-powered analysis complete!'
    });
  } catch (error) {
    console.error('Error analyzing typing session:', error);
    res.status(500).json({ 
      error: 'Failed to analyze session',
      details: error.message 
    });
  }
});

// 4. Get comprehensive child typing analytics
app.get('/api/typing/child-analysis', async (req, res) => {
  try {
    const { therapistCode, username } = req.query;
    
    if (!therapistCode || !username) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const therapist = await Therapist.findOne({
      code: therapistCode,
      'children.username': username
    });

    if (!therapist) {
      return res.status(404).json({ error: 'Therapist or child not found' });
    }

    const child = therapist.children.find(c => c.username === username);
    
    // Collect all typing data across sessions
    const allTypingResults = [];
    const sessionAnalyses = [];
    const progressTimeline = [];

    child.sessions.forEach(session => {
      if (session.typingResults && session.typingResults.length > 0) {
        allTypingResults.push(...session.typingResults);
        
        // Ensure analysis exists
        let analysisForSession = session.typingAnalysis;
        if (!analysisForSession) {
          try {
            analysisForSession = analyzeResultsLocally(session.typingResults);
          } catch (e) {
            analysisForSession = null;
          }
        }
        
        if (analysisForSession) {
          sessionAnalyses.push({
            sessionId: session.sessionId,
            analysis: analysisForSession,
            date: analysisForSession.analyzedAt || session.date
          });
          
          // Track progress over time
          progressTimeline.push({
            date: session.date,
            accuracy: analysisForSession.overallAccuracy,
            wordsCompleted: session.typingResults.length
          });
        }
      }
    });

    // Calculate overall statistics
    const totalWords = allTypingResults.length;
    const correctWords = allTypingResults.filter(r => r.correct).length;
    const overallAccuracy = totalWords > 0 ? (correctWords / totalWords * 100).toFixed(2) : 0;
    
    // Get aggregate problem letters across all sessions
    const aggregateAnalysis = analyzeResultsLocally(allTypingResults);

    res.json({
      success: true,
      username: username,
      overallStats: {
        totalWords,
        correctWords,
        overallAccuracy: parseFloat(overallAccuracy),
        totalSessions: sessionAnalyses.length
      },
      aggregateInsights: {
        topProblemLetters: aggregateAnalysis.problematicLetters.slice(0, 5),
        strengths: aggregateAnalysis.strengths.slice(0, 5),
        confusionPatterns: aggregateAnalysis.confusionPatterns.slice(0, 5),
        recommendations: aggregateAnalysis.recommendations,
        emotionalState: aggregateAnalysis.emotionalState,
        encouragement: aggregateAnalysis.encouragement
      },
      sessionAnalyses,
      progressTimeline: progressTimeline.sort((a, b) => new Date(a.date) - new Date(b.date)),
      hasData: totalWords > 0,
      aiPowered: true
    });
  } catch (error) {
    console.error('Error fetching child typing analysis:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. ENHANCED: Save typing results with automatic AI analysis
app.post('/api/save-typing-results', async (req, res) => {
  try {
    const { therapistCode, username, sessionId, results } = req.body;
    
    if (!therapistCode || !username || !sessionId || !results) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const therapist = await Therapist.findOne({ 
      code: therapistCode, 
      'children.username': username, 
      'children.sessions.sessionId': sessionId 
    });
    
    if (!therapist) return res.status(404).json({ error: 'Not found' });

    const childIndex = therapist.children.findIndex(c => c.username === username);
    const sessionIndex = therapist.children[childIndex].sessions.findIndex(s => s.sessionId === sessionId);
    
    if (sessionIndex === -1) return res.status(404).json({ error: 'Session not found' });

    const session = therapist.children[childIndex].sessions[sessionIndex];

    // Validate session game preference
    if (session.preferredGame && session.preferredGame !== 'typing') {
      return res.status(400).json({ 
        error: 'Typing results not allowed for this session (preferred game mismatch)' 
      });
    }

    // Save results
    session.typingResults = session.typingResults || [];
    session.typingResultsMap = session.typingResultsMap || {};
    
    results.forEach(r => {
      session.typingResults.push({ 
        word: r.word, 
        input: r.input, 
        correct: !!r.correct, 
        timeSpent: r.timeSpent || 0,
        hesitations: r.hesitations || 0,
        completedAt: new Date() 
      });
      session.typingResultsMap[r.word] = r.input;
    });

    // ALWAYS run AI analysis
    let autoAnalysis = null;
    try {
      console.log('🧠 Running AI analysis on', session.typingResults.length, 'words...');
      autoAnalysis = analyzeResultsLocally(session.typingResults);
      
      session.typingAnalysis = {
        ...autoAnalysis,
        analyzedAt: new Date(),
        totalWords: session.typingResults.length,
        correctWords: session.typingResults.filter(r => r.correct).length,
        aiPowered: true
      };
      
      await therapist.save();
      
      console.log('✅ AI Analysis saved successfully');
      console.log('📊 Performance:', autoAnalysis.overallAccuracy + '% accuracy');
      console.log('🎯 Problem letters:', autoAnalysis.problematicLetters.slice(0, 5).join(', '));
      console.log('💝 Emotional state:', autoAnalysis.emotionalState);
      
    } catch (analysisError) {
      console.error('❌ AI Analysis failed:', analysisError);
    }

    res.json({ 
      success: true,
      autoAnalysis: autoAnalysis,
      totalWords: session.typingResults.length,
      message: '🎉 Results saved with AI insights!',
      aiPowered: true
    });
    
  } catch (error) {
    console.error('Error saving typing results:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 6. NEW: Get real-time performance feedback endpoint
app.post('/api/typing/real-time-feedback', async (req, res) => {
  try {
    const { currentResults } = req.body;
    
    if (!currentResults || currentResults.length === 0) {
      return res.status(400).json({ error: 'No results provided' });
    }

    // Quick analysis of current session
    const quickAnalysis = analyzeResultsLocally(currentResults);
    
    res.json({
      success: true,
      feedback: {
        currentAccuracy: quickAnalysis.overallAccuracy,
        emotionalState: quickAnalysis.emotionalState,
        encouragement: quickAnalysis.encouragement,
        needsSupport: quickAnalysis.emotionalState === 'struggling' || quickAnalysis.emotionalState === 'frustrated',
        suggestedDifficulty: calculateAdaptiveDifficulty(currentResults)
      }
    });
    
  } catch (error) {
    console.error('Error providing real-time feedback:', error);
    res.status(500).json({ error: 'Failed to generate feedback' });
  }
});

console.log('✨ AI-Enhanced Typing Game Endpoints Loaded!');
console.log('🧠 Features: Adaptive difficulty, problem letter targeting, emotional support');
console.log('📊 Word Bank: ' + ALL_TYPING_WORDS.length + ' words across 3 difficulty levels');
// Save typing results for a session
// app.post('/api/save-typing-results', async (req, res) => {
//   try {
//     const { therapistCode, username, sessionId, results } = req.body; // results = [{word,input,correct}]
//     if (!therapistCode || !username || !sessionId || !results) return res.status(400).json({ error: 'Missing fields' });

//     const therapist = await Therapist.findOne({ code: therapistCode, 'children.username': username, 'children.sessions.sessionId': sessionId });
//     if (!therapist) return res.status(404).json({ error: 'Not found' });

//     const childIndex = therapist.children.findIndex(c => c.username === username);
//     const sessionIndex = therapist.children[childIndex].sessions.findIndex(s => s.sessionId === sessionId);
//     if (sessionIndex === -1) return res.status(404).json({ error: 'Session not found' });

//     const session = therapist.children[childIndex].sessions[sessionIndex];

//     // Only allow saving typing results if session.preferredGame is 'typing'
//     if (session.preferredGame && session.preferredGame !== 'typing') {
//       return res.status(400).json({ error: 'Typing results not allowed for this session (preferred game mismatch)' });
//     }

//     // Append typing results to session.typingResults
//     session.typingResults = session.typingResults || [];
//     session.typingResultsMap = session.typingResultsMap || {};
//     results.forEach(r => {
//       session.typingResults.push({ word: r.word, input: r.input, correct: !!r.correct, completedAt: new Date() });
//       session.typingResultsMap[r.word] = r.input;
//     });

//     await therapist.save();
//     res.json({ success: true });
//   } catch (error) {
//     console.error('Error saving typing results:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// Get Therapist Details
app.post('/api/get-therapist', async (req, res) => {
  try {
    const { username } = req.body;
    const therapist = await Therapist.findOne({ username });
    if (!therapist) return res.status(404).json({ message: 'Therapist not found' });

    res.status(200).json({
      username: therapist.username,
      code: therapist.code,
      children: therapist.children,
    });
  } catch (error) {
    console.error('Error fetching therapist:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Child Login (starts a new session)
app.post('/api/child-login', async (req, res) => {
  try {
    const { code, childName } = req.body;
    if (!code || !childName) {
      return res.status(400).json({ message: 'Both therapist code and child name are required' });
    }

    const therapist = await Therapist.findOne({ code });
    
    if (!therapist) return res.status(404).json({ message: 'Therapist not found' });

    const childIndex = therapist.children.findIndex(child => child.username === childName);
    console.log(childIndex);
    if (childIndex === -1) return res.status(401).json({ message: 'Child not found under this therapist' });

    // Create a new session
    const sessionId = generateSessionId();
    therapist.children[childIndex].sessions.push({
      sessionId,
      assignedThemes: [...(therapist.children[childIndex].currentAssignedThemes || therapist.children[childIndex].assignedThemes || [])],
      themesChanged: [],
      emotionsOfChild: [],
      playedPuzzles: [],
      typingResults: [],
      typingResultsMap: {},
      preferredGame: therapist.children[childIndex].preferredGame || null,
      preferredStory: therapist.children[childIndex].preferredStory || null,
    });

    await therapist.save();

    res.status(200).json({
      message: 'Child login successful',
      username: childName,
      sessionId,
      assignedThemes: therapist.children[childIndex].currentAssignedThemes || therapist.children[childIndex].assignedThemes || []
      ,
      preferredStory: therapist.children[childIndex].preferredStory || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get child themes
app.get('/api/get-child-themes', async (req, res) => {
  try {
    const therapist = await Therapist.findOne({
      code: req.query.therapistCode,
      "children.username": req.query.username
    });

    const child = therapist?.children.find(c => c.username === req.query.username);
    res.json({
      themes: child?.currentAssignedThemes || child?.assignedThemes || ['underwater']
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update child themes (for therapist assignment)
app.post('/api/update-child-themes', async (req, res) => {
  try {
    const { username, therapistCode, themes } = req.body;
    await Therapist.updateOne(
      { code: therapistCode, "children.username": username },
      { $set: { "children.$.currentAssignedThemes": themes, "children.$.assignedThemes": themes } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update themes" });
  }
});

// Track theme changes during session
app.post('/api/track-theme-change', async (req, res) => {
  try {
    const { username, therapistCode, sessionId, theme } = req.body;

    // Validate required fields
    if (!username || !therapistCode || !sessionId || !theme) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const therapist = await Therapist.findOne({
      code: therapistCode,
      "children.username": username,
      "children.sessions.sessionId": sessionId
    });

    if (!therapist) {
      return res.status(404).json({ error: "Therapist or session not found" });
    }

    const childIndex = therapist.children.findIndex(c => c.username === username);
    if (childIndex === -1) {
      return res.status(404).json({ error: "Child not found" });
    }

    const sessionIndex = therapist.children[childIndex].sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Initialize themesChanged array if it doesn't exist
    if (!therapist.children[childIndex].sessions[sessionIndex].themesChanged) {
      therapist.children[childIndex].sessions[sessionIndex].themesChanged = [];
    }

    // Always push the theme to themesChanged array
    // This ensures we track all theme transitions, even if the theme remains the same
    therapist.children[childIndex].sessions[sessionIndex].themesChanged.push(theme);

    // Save the changes
    await therapist.save();

    res.json({
      success: true,
      message: "Theme change tracked successfully",
      currentTheme: theme
    });
  } catch (error) {
    console.error('Error tracking theme change:', error);
    res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

// Track emotions during session
app.post('/api/track-emotion', async (req, res) => {
  try {
    const { username, therapistCode, sessionId, emotion } = req.body;

    const therapist = await Therapist.findOne({
      code: therapistCode,
      "children.username": username,
      "children.sessions.sessionId": sessionId
    });

    if (!therapist) return res.status(404).json({ error: "Not found" });

    const child = therapist.children.find(c => c.username === username);
    const session = child.sessions.find(s => s.sessionId === sessionId);

    session.emotionsOfChild.push(emotion);
    await therapist.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Track played puzzles for session-based tracking
app.post('/api/update-played-puzzles', async (req, res) => {
  try {
    const { username, therapistCode, sessionId, theme, level, puzzleId, emotionsDuring } = req.body;

    // Validate required fields
    if (!username || !therapistCode || !sessionId || !theme || !level || !puzzleId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const therapist = await Therapist.findOne({
      code: therapistCode,
      "children.username": username,
      "children.sessions.sessionId": sessionId
    });

    if (!therapist) {
      return res.status(404).json({ error: "Therapist, child, or session not found" });
    }

    const childIndex = therapist.children.findIndex(c => c.username === username);
    const sessionIndex = therapist.children[childIndex].sessions.findIndex(s => s.sessionId === sessionId);

    // Add puzzle to session tracking
    therapist.children[childIndex].sessions[sessionIndex].playedPuzzles.push({
      theme,
      level: Number(level),
      puzzleId,
      completedAt: new Date(),
      emotionsDuring: emotionsDuring || []
    });

    // Also update the backward-compatible playedPuzzles array
    if (!therapist.children[childIndex].playedPuzzles.includes(puzzleId)) {
      therapist.children[childIndex].playedPuzzles.push(puzzleId);
    }

    await therapist.save();

    res.json({ 
      success: true,
      message: "Puzzle completion recorded successfully"
    });
  } catch (error) {
    console.error('Error tracking puzzle completion:', error);
    res.status(500).json({ 
      error: "Server error",
      details: error.message
    });
  }
});

// Get session data
app.get('/api/get-session-data', async (req, res) => {
  try {
    const { therapistCode, childName, sessionId } = req.query;

    if (!therapistCode || !childName || !sessionId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const therapist = await Therapist.findOne({ 
      code: therapistCode,
      "children.username": childName
    });

    if (!therapist) {
      return res.status(404).json({ error: "Therapist or child not found" });
    }

    const child = therapist.children.find(c => c.username === childName);
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    const session = child.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({
      sessionData: session,
      success: true
    });
  } catch (error) {
    console.error('Error fetching session data:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all sessions for a child
app.get('/api/get-child-sessions', async (req, res) => {
  try {
    const { therapistCode, childName } = req.query;

    if (!therapistCode || !childName) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const therapist = await Therapist.findOne({ 
      code: therapistCode,
      "children.username": childName
    });

    if (!therapist) {
      return res.status(404).json({ error: "Therapist or child not found" });
    }

    const child = therapist.children.find(c => c.username === childName);
    if (!child) {
      return res.status(404).json({ error: "Child not found" });
    }

    res.json({
      sessions: child.sessions || [],
      success: true
    });
  } catch (error) {
    console.error('Error fetching child sessions:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Submit feedback
app.post('/api/submit-feedback', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    const feedback = new Feedback({
      name,
      email,
      message
    });
    
    await feedback.save();
    
    res.status(201).json({ 
      success: true,
      message: "Feedback submitted successfully"
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all feedback (admin only)
app.get('/api/get-feedback', async (req, res) => {
  try {
    const { adminKey } = req.query;
    
    if (adminKey !== 'admin-secret-key') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const feedback = await Feedback.find().sort({ createdAt: -1 });
    res.json({ feedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Add FAQ
app.post('/api/add-faq', async (req, res) => {
  try {
    const { name,email,question } = req.body;
    if (!question || !name || !email) {
      return res.status(400).json({ error: "Question and answer are required" });
    }
    
    const faq = new FAQ({
      name,
      email,
      question
    });
    
    await faq.save();
    
    res.status(201).json({ 
      success: true,
      message: "FAQ added successfully"
    });
  } catch (error) {
    console.error('Error adding FAQ:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all FAQs
app.get('/api/get-faqs', async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ createdAt: -1 });
    res.json({ faqs });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete Child
app.post('/api/delete-child', async (req, res) => {
  try {
    const { therapistCode, childName } = req.body;
    
    if (!therapistCode || !childName) {
      return res.status(400).json({ error: "Therapist code and child name are required" });
    }
    
    const therapist = await Therapist.findOne({ code: therapistCode });
    if (!therapist) {
      return res.status(404).json({ error: "Therapist not found" });
    }
    
    const childIndex = therapist.children.findIndex(child => child.username === childName);
    if (childIndex === -1) {
      return res.status(404).json({ error: "Child not found" });
    }
    
    // Remove the child from the therapist's children array
    therapist.children.splice(childIndex, 1);
    await therapist.save();
    
    res.json({ 
      success: true, 
      message: "Child deleted successfully" 
    });
  } catch (error) {
    console.error('Error deleting child:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Change Therapist Password
app.post('/api/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    const therapist = await Therapist.findOne({ username, password: currentPassword });
    if (!therapist) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    therapist.password = newPassword;
    await therapist.save();
    
    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/superadmin/login', (req, res) => {
  const { username, password } = req.body;

  // Replace with your actual Super Admin credentials
  const SUPER_ADMIN_USERNAME = 'admin';
  const SUPER_ADMIN_PASSWORD = 'admin123';

  if (username === SUPER_ADMIN_USERNAME && password === SUPER_ADMIN_PASSWORD) {
    res.json({ message: 'Super Admin login successful' });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

app.post('/api/superadmin/register-therapist', authenticateSuperAdmin, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    // Generate a unique code for the therapist
    const code = await generateUniqueCode();

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new therapist
    const therapist = new Therapist({ username, password: hashedPassword, code });
    await therapist.save();

    res.status(201).json({ message: 'Therapist registered successfully', code });
  } catch (error) {
    console.error('Error registering therapist:', error);
    res.status(500).json({ message: 'Failed to register therapist' });
  }
});

app.get('/api/superadmin/therapists', authenticateSuperAdmin, async (req, res) => {
  try {
    const therapists = await Therapist.find({}, { username: 1, code: 1, _id: 1 }); // Fetch only necessary fields
    res.status(200).json(therapists);
  } catch (error) {
    console.error('Error fetching therapists:', error);
    res.status(500).json({ message: 'Failed to fetch therapists' });
  }
});

app.delete('/api/superadmin/delete-therapist/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const therapist = await Therapist.findByIdAndDelete(id);

    if (!therapist) {
      return res.status(404).json({ message: 'Therapist not found' });
    }

    res.status(200).json({ message: 'Therapist deleted successfully' });
  } catch (error) {
    console.error('Error deleting therapist:', error);
    res.status(500).json({ message: 'Failed to delete therapist' });
  }
});

// Middleware to authenticate Super Admin
function authenticateSuperAdmin(req, res, next) {
  // Simply allow all requests to pass through
  next();
}

let currentPuzzleEmotions = [];

app.post('/api/facemesh-landmarks', async (req, res) => {
  const { landmarks } = req.body;
  console.log("Received Landmarks",landmarks.length)
  try {
    const response = await axios.post('http://127.0.0.1:5001/predict', { landmarks });
    const emotion = response.data.emotion;
    console.log('Predicted emotion from model:', emotion);
    currentPuzzleEmotions.push(emotion); // accumulate emotions
    res.status(200).json({ emotion });
  } catch (error) {
    res.status(500).json({ error: 'Failed to predict emotion' });
  }
});
 
app.get('/api/emotion', (req, res) => {
  if (currentPuzzleEmotions.length === 0) {
    return res.status(404).json({ error: 'No emotions recorded for this puzzle yet' });
  }

  // Calculate the most frequent (mode)
  const counts = {};
  for (const e of currentPuzzleEmotions) {
    counts[e] = (counts[e] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominantEmotion = sorted[0][0];
  console.log(currentPuzzleEmotions)
  // Clear history for the next puzzle
  currentPuzzleEmotions = [];

  res.json({ emotion: dominantEmotion });
});

app.get('/api/wordlists', async (req, res) => {
  try {
    const wordLists = await WordList.find();
    res.status(200).json(wordLists);
  } catch (error) {
    console.error('Error fetching word lists:', error);
    res.status(500).json({ error: 'Failed to fetch word lists' });
  }
});

// Migration endpoint: normalize therapist->children->sessions schema
// WARNING: Run this once in a controlled environment. It will modify DB documents.
app.post('/api/migrate-sessions', async (req, res) => {
  try {
    const therapists = await Therapist.find();
    let updated = 0;
    for (const t of therapists) {
      let changed = false;
      const newChildren = (t.children || []).map(child => {
        const c = child.toObject ? child.toObject() : JSON.parse(JSON.stringify(child));
        if (c.preferredGame === undefined) {
          c.preferredGame = null;
          changed = true;
        }
        c.sessions = (c.sessions || []).map(session => {
          const s = session;
          if (!s.typingResults) { s.typingResults = []; changed = true; }
          if (!s.typingResultsMap) { s.typingResultsMap = {}; changed = true; }
          if (s.preferredGame === undefined) { s.preferredGame = c.preferredGame || null; changed = true; }
          return s;
        });
        return c;
      });
      if (changed) {
        t.children = newChildren;
        await t.save();
        updated++;
      }
    }
    res.json({ success: true, updated });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Get stories list
app.get('/api/stories', async (req, res) => {
  try {
    const stories = await Story.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, stories });
  } catch (err) {
    console.error('Error fetching stories', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get a story by ID
app.get('/api/stories/:id', async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }
    res.json({ success: true, story });
  } catch (err) {
    console.error('Error fetching story', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Set preferred story for a child
app.post('/api/set-preferred-story', async (req, res) => {
  try {
    const { therapistCode, username, storyId } = req.body;
    if (!therapistCode || !username || !storyId) return res.status(400).json({ error: 'Missing fields' });

    await Therapist.updateOne(
      { code: therapistCode, 'children.username': username },
      { 
        $set: { 
          'children.$.preferredStory': storyId,
          'children.$.preferredGame': 'reading'
        } 
      }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error setting preferred story', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save reading audio (base64 or URL) to session recordings
app.post('/api/save-reading-audio', async (req, res) => {
  try {
    const { therapistCode, username, sessionId, storyId, audioData } = req.body;
    if (!therapistCode || !username || !sessionId || !storyId || !audioData) return res.status(400).json({ error: 'Missing fields' });

    const therapist = await Therapist.findOne({ code: therapistCode, 'children.username': username, 'children.sessions.sessionId': sessionId });
    if (!therapist) return res.status(404).json({ error: 'Not found' });

    const childIndex = therapist.children.findIndex(c => c.username === username);
    const sessionIndex = therapist.children[childIndex].sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) return res.status(404).json({ error: 'Session not found' });

    // Find the story title first
    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    const session = therapist.children[childIndex].sessions[sessionIndex];
    session.readingRecordings = session.readingRecordings || [];
    session.readingRecordings.push({ 
      storyId, 
      storyTitle: story.title,
      audioData, 
      recordedAt: new Date() 
    });

    await therapist.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving reading audio', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get child's preferredGame and preferredStory
// Get child's reading recordings
app.get('/api/get-reading-recordings', async (req, res) => {
  try {
    const { therapistCode, username } = req.query;
    if (!therapistCode || !username) return res.status(400).json({ success: false, error: 'Missing params' });

    const therapist = await Therapist.findOne({ code: therapistCode })
      .populate('children.sessions.readingRecordings.storyId'); // Populate story details
    if (!therapist) return res.status(404).json({ success: false, error: 'Therapist not found' });

    const child = therapist.children.find(c => c.username === String(username));
    if (!child) return res.status(404).json({ success: false, error: 'Child not found' });

    // Get all story IDs first to fetch story details in batch
    const allStoryIds = new Set();
    child.sessions.forEach(s => {
      if (s.readingRecordings) {
        s.readingRecordings.forEach(r => {
          const storyId = typeof r.storyId === 'object' ? r.storyId?._id || r.storyId?.id : r.storyId;
          if (storyId) allStoryIds.add(String(storyId));
        });
      }
    });

    // Fetch all stories at once
    const stories = await Story.find({ _id: { $in: Array.from(allStoryIds) } });
    const storiesMap = new Map();
    stories.forEach(s => storiesMap.set(String(s._id), s));

    // Get all sessions with recordings
    const sessionsWithRecordings = child.sessions
      .filter(s => s.readingRecordings && s.readingRecordings.length > 0)
      .map(s => ({
        sessionId: s.sessionId,
        date: s.date,
        recordings: s.readingRecordings.map(r => {
          const storyId = typeof r.storyId === 'object' ? r.storyId?._id || r.storyId?.id : r.storyId;
          const story = storiesMap.get(String(storyId));
          
          return {
            storyId: String(storyId || r.storyId),
            storyTitle: r.storyTitle || story?.title || 'Unknown Story',
            storyContent: story?.story || '',
            storyMoral: story?.moral || '',
            recordedAt: r.recordedAt,
            audioData: r.audioData
          };
        })
      }))
      // Sort sessions by date, newest first
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(sessionsWithRecordings);
  } catch (err) {
    console.error('Error fetching reading recordings', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/get-child-preference', async (req, res) => {
  try {
    const { therapistCode, username } = req.query;
    if (!therapistCode || !username) return res.status(400).json({ success: false, error: 'Missing params' });

    const therapist = await Therapist.findOne({ code: therapistCode });
    if (!therapist) return res.status(404).json({ success: false, error: 'Therapist not found' });

    const child = therapist.children.find(c => c.username === String(username));
    if (!child) return res.status(404).json({ success: false, error: 'Child not found' });

    res.json({ 
      success: true, 
      preferredGame: child.preferredGame || null, 
      assignedGames: child.assignedGames || [],
      completedGames: child.completedGames || [],
      preferredStory: child.preferredStory || null 
    });
  } catch (err) {
    console.error('Error fetching child preference', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get questions for a story by title
app.get('/api/questions/:storyTitle', async (req, res) => {
  try {
    const storyTitle = decodeURIComponent(req.params.storyTitle);
    const questionsPath = path.join(__dirname, '../questions.json');
    
    if (!fs.existsSync(questionsPath)) {
      return res.status(404).json({ success: false, error: 'Questions file not found' });
    }
    
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
    const storyQuestions = questionsData.find(q => q.storyTitle === storyTitle);
    
    if (!storyQuestions) {
      return res.status(404).json({ success: false, error: 'Questions not found for this story' });
    }
    
    res.json({ success: true, questions: storyQuestions.questions });
  } catch (err) {
    console.error('Error fetching questions', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== LETTER TRACING ENDPOINTS ====================

// Save traced letter image
app.post('/api/tracing/save', async (req, res) => {
  try {
    const { therapistCode, username, sessionId, letter, imageData } = req.body;
    
    if (!therapistCode || !username || !sessionId || !letter || !imageData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find the therapist and session
    const therapist = await Therapist.findOne({ 
      code: therapistCode, 
      'children.username': username,
      'children.sessions.sessionId': sessionId 
    });

    if (!therapist) {
      return res.status(404).json({ error: 'Therapist or session not found' });
    }

    const childIndex = therapist.children.findIndex(c => c.username === username);
    const sessionIndex = therapist.children[childIndex].sessions.findIndex(s => s.sessionId === sessionId);
    
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = therapist.children[childIndex].sessions[sessionIndex];

    // Ensure session has preferredGame set to 'tracing' if not already set
    if (!session.preferredGame) {
      session.preferredGame = 'tracing';
    }

    // Initialize tracing results if needed
    if (!session.tracingResults) {
      session.tracingResults = [];
    }

    // Save tracing result to session (just the image, no evaluation)
    session.tracingResults.push({
      letter: letter,
      imageData: imageData, // Store the traced image
      tracedAt: new Date()
    });

    await therapist.save();

    res.json({
      success: true,
      message: 'Tracing saved successfully'
    });

  } catch (error) {
    console.error('Error saving tracing:', error);
    res.status(500).json({ 
      error: 'Failed to save tracing', 
      details: error.message 
    });
  }
});

// Get tracing results for a child session
app.get('/api/tracing/results', async (req, res) => {
  try {
    const { therapistCode, username, sessionId } = req.query;
    
    if (!therapistCode || !username || !sessionId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const therapist = await Therapist.findOne({ 
      code: therapistCode,
      'children.username': username,
      'children.sessions.sessionId': sessionId 
    });

    if (!therapist) {
      return res.status(404).json({ error: 'Therapist or session not found' });
    }

    const child = therapist.children.find(c => c.username === username);
    const session = child.sessions.find(s => s.sessionId === sessionId);

    if (!session.tracingResults) {
      return res.json({ success: true, results: [] });
    }

    res.json({
      success: true,
      results: session.tracingResults
    });

  } catch (error) {
    console.error('Error fetching tracing results:', error);
    res.status(500).json({ error: 'Server error' });
  }
});