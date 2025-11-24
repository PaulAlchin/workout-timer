/**
 * Workout Timer App - Main JavaScript
 * Handles timer logic, state management, UI updates, presets, and audio/vibration
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Main workout state object
 * Tracks current phase, timing, progress, and settings
 */
let workoutState = {
    // Configuration from form
    config: {
        workoutName: '',
        warmupDuration: 0,
        workDuration: 30,
        restDuration: 10,
        longRestDuration: 60,
        setsPerRound: 4,
        numberOfRounds: 1
    },
    
    // Current timer state
    currentPhase: 'ready', // 'ready', 'warmup', 'work', 'rest', 'longRest', 'complete'
    currentRound: 0,
    currentSet: 0,
    nextSet: 0, // For rest phases: the next set we're resting before
    timeRemaining: 0,
    totalWorkoutTime: 0,
    elapsedTime: 0,
    
    // Control state
    intervalId: null,
    isPaused: false,
    isRunning: false,
    isCompleting: false, // Flag to prevent multiple completion dialogs
    isTransitioning: false, // Flag to prevent multiple phase transitions
    
    // Phase tracking for transitions
    phaseSequence: [],
    currentPhaseIndex: 0,
    
    // Settings
    soundsEnabled: true,
    vibrationEnabled: true
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
    // Timer display
    timerSection: document.getElementById('timerSection'),
    phaseIndicator: document.getElementById('phaseIndicator'),
    timerDisplay: document.getElementById('timerDisplay'),
    roundInfo: document.getElementById('roundInfo'),
    setInfo: document.getElementById('setInfo'),
    progressBar: document.getElementById('progressBar'),
    
    // Controls
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    
    // Settings
    enableSounds: document.getElementById('enableSounds'),
    enableVibration: document.getElementById('enableVibration'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    
    // Form
    workoutForm: document.getElementById('workoutForm'),
    workoutName: document.getElementById('workoutName'),
    warmupDuration: document.getElementById('warmupDuration'),
    workDuration: document.getElementById('workDuration'),
    restDuration: document.getElementById('restDuration'),
    longRestDuration: document.getElementById('longRestDuration'),
    setsPerRound: document.getElementById('setsPerRound'),
    numberOfRounds: document.getElementById('numberOfRounds'),
    
    // Presets
    savePresetBtn: document.getElementById('savePresetBtn'),
    presetsList: document.getElementById('presetsList')
};

// ============================================================================
// TIMER ENGINE
// ============================================================================

/**
 * Builds the phase sequence array based on workout configuration
 * Phase sequence: warmup (if > 0) → [round: (work → rest)*sets → longRest]*rounds
 */
function buildPhaseSequence() {
    const sequence = [];
    const config = workoutState.config;
    
    // Add warm-up phase if duration > 0
    if (config.warmupDuration > 0) {
        sequence.push({
            type: 'warmup',
            duration: config.warmupDuration,
            round: 0,
            set: 0
        });
    }
    
    // Build rounds
    for (let round = 1; round <= config.numberOfRounds; round++) {
        // Add sets (work + rest pairs)
        for (let set = 1; set <= config.setsPerRound; set++) {
            // Work phase
            sequence.push({
                type: 'work',
                duration: config.workDuration,
                round: round,
                set: set // Current set number
            });
            
            // Rest phase (only if not the last set in the round)
            // Store the completed set number for display
            if (set < config.setsPerRound && config.restDuration > 0) {
                sequence.push({
                    type: 'rest',
                    duration: config.restDuration,
                    round: round,
                    set: set, // The set we just completed
                    nextSet: set + 1 // The next set we're resting before
                });
            }
        }
        
        // Long rest between rounds (except after last round)
        if (round < config.numberOfRounds && config.longRestDuration > 0) {
            sequence.push({
                type: 'longRest',
                duration: config.longRestDuration,
                round: round,
                set: 0
            });
        }
    }
    
    workoutState.phaseSequence = sequence;
    workoutState.currentPhaseIndex = 0;
    
    // Calculate total workout time
    workoutState.totalWorkoutTime = sequence.reduce((sum, phase) => sum + phase.duration, 0);
    
    // Debug: log the phase sequence (can be removed later)
    console.log('Phase sequence built:', sequence.length, 'phases');
    console.log('Sequence:', sequence.map((p, i) => `${i}: ${p.type} R${p.round} S${p.set}${p.nextSet ? ' (next:'+p.nextSet+')' : ''}`).join(', '));
}

/**
 * Starts the workout timer
 */
function startTimer() {
    // Check if user has interacted (required for audio)
    if (!workoutState.hasInteracted) {
        workoutState.hasInteracted = true;
    }
    
    // Load configuration from form
    loadConfigFromForm();
    
    // Validate configuration
    if (workoutState.config.workDuration <= 0) {
        alert('Work duration must be greater than 0');
        return;
    }
    
    if (workoutState.config.setsPerRound <= 0 || workoutState.config.numberOfRounds <= 0) {
        alert('Sets per round and number of rounds must be greater than 0');
        return;
    }
    
    // Build phase sequence
    buildPhaseSequence();
    
    if (workoutState.phaseSequence.length === 0) {
        alert('Invalid workout configuration');
        return;
    }
    
    // Initialize timer state
    workoutState.isRunning = true;
    workoutState.isPaused = false;
    workoutState.currentPhaseIndex = 0;
    workoutState.elapsedTime = 0;
    
    // Load first phase
    loadCurrentPhase();
    
    // Update UI
    elements.startBtn.style.display = 'none';
    elements.pauseBtn.style.display = 'inline-block';
    elements.resetBtn.disabled = false;
    
    // Disable form inputs during workout
    disableFormInputs(true);
    
    // Start the interval
    workoutState.intervalId = setInterval(updateTimer, 100);
    
    // Play start sound
    playBeep('start');
    vibrate([100]);
}

/**
 * Loads the current phase from the phase sequence
 */
function loadCurrentPhase() {
    // Validate index
    if (workoutState.currentPhaseIndex < 0 || workoutState.currentPhaseIndex >= workoutState.phaseSequence.length) {
        console.warn('Invalid phase index:', workoutState.currentPhaseIndex, 'of', workoutState.phaseSequence.length);
        completeWorkout();
        return;
    }
    
    const phase = workoutState.phaseSequence[workoutState.currentPhaseIndex];
    
    if (!phase) {
        console.error('Phase not found at index:', workoutState.currentPhaseIndex);
        completeWorkout();
        return;
    }
    
    workoutState.currentPhase = phase.type;
    workoutState.timeRemaining = phase.duration;
    workoutState.currentRound = phase.round;
    workoutState.currentSet = phase.set;
    workoutState.nextSet = phase.nextSet || 0; // Store next set for rest phases
    
    // Debug log
    console.log(`Phase ${workoutState.currentPhaseIndex}: ${phase.type}, Round ${workoutState.currentRound}, Set ${workoutState.currentSet}${workoutState.nextSet ? ', Next: ' + workoutState.nextSet : ''}`);
    
    updateDisplay();
}

/**
 * Main timer update function - called every 100ms
 */
function updateTimer() {
    if (!workoutState.isRunning || workoutState.isPaused || workoutState.isTransitioning) {
        return;
    }
    
    // Check if phase is complete BEFORE updating time (to prevent multiple transitions)
    const wasComplete = workoutState.timeRemaining <= 0;
    
    if (!wasComplete) {
        workoutState.timeRemaining -= 0.1;
        workoutState.elapsedTime += 0.1;
    }
    
    // Clamp time to 0 if negative
    if (workoutState.timeRemaining < 0) {
        workoutState.timeRemaining = 0;
    }
    
    // Update display
    updateDisplay();
    
    // Check if phase is complete (only once per phase)
    if (!wasComplete && workoutState.timeRemaining <= 0) {
        // Prevent multiple transitions
        workoutState.isTransitioning = true;
        
        // Play completion sound
        playBeep('end');
        vibrate([100]);
        
        // Move to next phase
        const nextIndex = workoutState.currentPhaseIndex + 1;
        
        // Small delay before next phase transition
        setTimeout(() => {
            // Check if still running (not paused/reset during delay)
            if (!workoutState.isRunning) {
                workoutState.isTransitioning = false;
                return;
            }
            
            // Update index only now
            workoutState.currentPhaseIndex = nextIndex;
            
            // Clear the transition flag
            workoutState.isTransitioning = false;
            
            if (workoutState.currentPhaseIndex < workoutState.phaseSequence.length) {
                const nextPhase = workoutState.phaseSequence[workoutState.currentPhaseIndex];
                
                if (!nextPhase) {
                    console.error('Next phase not found at index:', workoutState.currentPhaseIndex);
                    completeWorkout();
                    return;
                }
                
                // Different sound for round start
                if (nextPhase.type === 'work' && nextPhase.set === 1 && nextPhase.round > workoutState.currentRound) {
                    playBeep('roundStart');
                    vibrate([200, 100, 200]);
                }
                
                loadCurrentPhase();
            } else {
                completeWorkout();
            }
        }, 500);
    }
}

/**
 * Pauses the timer
 */
function pauseTimer() {
    if (!workoutState.isRunning) return;
    
    workoutState.isPaused = true;
    elements.pauseBtn.textContent = 'Resume';
}

/**
 * Resumes the timer
 */
function resumeTimer() {
    if (!workoutState.isRunning) return;
    
    workoutState.isPaused = false;
    elements.pauseBtn.textContent = 'Pause';
}

/**
 * Resets the timer to initial state
 */
function resetTimer() {
    // Clear interval
    if (workoutState.intervalId) {
        clearInterval(workoutState.intervalId);
        workoutState.intervalId = null;
    }
    
    // Reset state
    workoutState.isRunning = false;
    workoutState.isPaused = false;
    workoutState.isCompleting = false;
    workoutState.isTransitioning = false;
    workoutState.currentPhase = 'ready';
    workoutState.currentPhaseIndex = 0;
    workoutState.currentRound = 0;
    workoutState.currentSet = 0;
    workoutState.nextSet = 0;
    workoutState.timeRemaining = 0;
    workoutState.elapsedTime = 0;
    
    // Update UI
    elements.startBtn.style.display = 'inline-block';
    elements.pauseBtn.style.display = 'none';
    elements.pauseBtn.textContent = 'Pause';
    elements.resetBtn.disabled = false;
    
    // Enable form inputs
    disableFormInputs(false);
    
    // Reset display
    updateDisplay();
}

/**
 * Completes the workout
 */
function completeWorkout() {
    // Prevent multiple completion dialogs
    if (workoutState.isCompleting) {
        return;
    }
    
    workoutState.isCompleting = true;
    
    // Clear interval
    if (workoutState.intervalId) {
        clearInterval(workoutState.intervalId);
        workoutState.intervalId = null;
    }
    
    workoutState.isRunning = false;
    workoutState.currentPhase = 'complete';
    
    // Play completion sound
    playBeep('complete');
    vibrate([300, 100, 300, 100, 300]);
    
    // Update UI
    elements.phaseIndicator.textContent = 'Workout Complete!';
    elements.startBtn.style.display = 'inline-block';
    elements.pauseBtn.style.display = 'none';
    
    // Enable form inputs
    disableFormInputs(false);
    
    // Show completion message (only once)
    setTimeout(() => {
        const shouldRestart = confirm('Workout Complete! Would you like to start again?');
        
        // Reset the completing flag
        workoutState.isCompleting = false;
        
        if (shouldRestart) {
            resetTimer();
            // Small delay before restarting to ensure clean state
            setTimeout(() => {
                startTimer();
            }, 100);
        } else {
            resetTimer();
        }
    }, 1000);
}

// ============================================================================
// UI UPDATES
// ============================================================================

/**
 * Updates the timer display, phase indicator, and progress information
 */
function updateDisplay() {
    // Update timer display - clamp to 0 to prevent negative display
    const timeRemaining = Math.max(0, workoutState.timeRemaining);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    
    if (workoutState.currentPhase === 'ready' || workoutState.currentPhase === 'complete') {
        elements.timerDisplay.textContent = '00:00';
    } else {
        elements.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    // Update phase indicator
    const phaseLabels = {
        'ready': 'Ready',
        'warmup': 'Warm-up',
        'work': 'Work',
        'rest': 'Rest',
        'longRest': 'Long Rest',
        'complete': 'Complete'
    };
    
    elements.phaseIndicator.textContent = phaseLabels[workoutState.currentPhase] || 'Ready';
    
    // Update phase styling
    elements.timerSection.className = 'timer-section';
    if (workoutState.currentPhase !== 'ready' && workoutState.currentPhase !== 'complete') {
        elements.timerSection.classList.add(`phase-${workoutState.currentPhase}`);
    }
    
    // Update round and set info
    if (workoutState.currentPhase === 'warmup') {
        elements.roundInfo.textContent = '';
        elements.setInfo.textContent = '';
    } else if (workoutState.currentPhase === 'complete') {
        elements.roundInfo.textContent = 'Workout Complete!';
        elements.setInfo.textContent = '';
    } else if (workoutState.currentRound > 0) {
        elements.roundInfo.textContent = `Round ${workoutState.currentRound} of ${workoutState.config.numberOfRounds}`;
        
        if (workoutState.currentPhase === 'work') {
            // During work phase, show the current set from the phase
            const currentPhaseObj = workoutState.phaseSequence[workoutState.currentPhaseIndex];
            const displaySet = currentPhaseObj ? currentPhaseObj.set : workoutState.currentSet;
            elements.setInfo.textContent = `Set ${displaySet} of ${workoutState.config.setsPerRound}`;
        } else if (workoutState.currentPhase === 'rest') {
            // During rest phase, show the next set we're resting before
            const currentPhaseObj = workoutState.phaseSequence[workoutState.currentPhaseIndex];
            const nextSet = currentPhaseObj ? (currentPhaseObj.nextSet || workoutState.nextSet) : workoutState.nextSet;
            
            if (nextSet > 0 && nextSet <= workoutState.config.setsPerRound) {
                elements.setInfo.textContent = `Rest before Set ${nextSet} of ${workoutState.config.setsPerRound}`;
            } else {
                // Fallback: show the set we just completed
                elements.setInfo.textContent = `Set ${workoutState.currentSet} - Rest`;
            }
        } else if (workoutState.currentPhase === 'longRest') {
            elements.setInfo.textContent = 'Rest between rounds';
        } else {
            elements.setInfo.textContent = '';
        }
    }
    
    // Update progress bar
    updateProgressBar();
}

/**
 * Updates the progress bar based on overall workout progress
 */
function updateProgressBar() {
    if (workoutState.totalWorkoutTime === 0) {
        elements.progressBar.style.width = '0%';
        return;
    }
    
    const progress = (workoutState.elapsedTime / workoutState.totalWorkoutTime) * 100;
    elements.progressBar.style.width = `${Math.min(progress, 100)}%`;
}

/**
 * Disables or enables form inputs
 */
function disableFormInputs(disable) {
    const inputs = [
        elements.workoutName,
        elements.warmupDuration,
        elements.workDuration,
        elements.restDuration,
        elements.longRestDuration,
        elements.setsPerRound,
        elements.numberOfRounds,
        elements.savePresetBtn
    ];
    
    inputs.forEach(input => {
        input.disabled = disable;
    });
}

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Loads configuration from form inputs
 */
function loadConfigFromForm() {
    workoutState.config = {
        workoutName: elements.workoutName.value.trim(),
        warmupDuration: parseInt(elements.warmupDuration.value) || 0,
        workDuration: parseInt(elements.workDuration.value) || 30,
        restDuration: parseInt(elements.restDuration.value) || 0,
        longRestDuration: parseInt(elements.longRestDuration.value) || 0,
        setsPerRound: parseInt(elements.setsPerRound.value) || 1,
        numberOfRounds: parseInt(elements.numberOfRounds.value) || 1
    };
}

/**
 * Populates form inputs from configuration object
 */
function populateFormFromConfig(config) {
    elements.workoutName.value = config.workoutName || '';
    elements.warmupDuration.value = config.warmupDuration || 0;
    elements.workDuration.value = config.workDuration || 30;
    elements.restDuration.value = config.restDuration || 0;
    elements.longRestDuration.value = config.longRestDuration || 0;
    elements.setsPerRound.value = config.setsPerRound || 1;
    elements.numberOfRounds.value = config.numberOfRounds || 1;
}

// ============================================================================
// SOUND & VIBRATION
// ============================================================================

let audioContext = null;

/**
 * Initializes the audio context (must be called after user interaction)
 */
function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Audio context not supported:', e);
        }
    }
}

/**
 * Plays a beep sound using Web Audio API
 * @param {string} type - 'start', 'end', 'roundStart', 'complete'
 */
function playBeep(type = 'end') {
    if (!workoutState.soundsEnabled || !audioContext) {
        return;
    }
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different frequencies for different beep types
        const frequencies = {
            'start': 800,
            'end': 400,
            'roundStart': 600,
            'complete': 500
        };
        
        oscillator.frequency.value = frequencies[type] || 400;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        
        // Double beep for round start
        if (type === 'roundStart') {
            setTimeout(() => {
                const oscillator2 = audioContext.createOscillator();
                const gainNode2 = audioContext.createGain();
                oscillator2.connect(gainNode2);
                gainNode2.connect(audioContext.destination);
                oscillator2.frequency.value = 600;
                oscillator2.type = 'sine';
                gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator2.start(audioContext.currentTime);
                oscillator2.stop(audioContext.currentTime + 0.3);
            }, 200);
        }
    } catch (e) {
        console.warn('Error playing beep:', e);
    }
}

/**
 * Triggers device vibration if enabled and supported
 * @param {Array<number>} pattern - Vibration pattern in milliseconds
 */
function vibrate(pattern) {
    if (!workoutState.vibrationEnabled) {
        return;
    }
    
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            console.warn('Vibration failed:', e);
        }
    }
}

// ============================================================================
// PRESETS SYSTEM
// ============================================================================

const PRESETS_STORAGE_KEY = 'workoutTimer_presets';
const SETTINGS_STORAGE_KEY = 'workoutTimer_settings';

/**
 * Saves a workout preset to localStorage
 */
function savePreset() {
    loadConfigFromForm();
    
    if (!workoutState.config.workoutName) {
        alert('Please enter a workout name to save as preset');
        elements.workoutName.focus();
        return;
    }
    
    try {
        const presets = loadPresetsFromStorage();
        presets[workoutState.config.workoutName] = { ...workoutState.config };
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
        
        loadPresets();
        alert(`Preset "${workoutState.config.workoutName}" saved!`);
    } catch (e) {
        console.error('Error saving preset:', e);
        alert('Error saving preset. localStorage may not be available.');
    }
}

/**
 * Loads all presets from localStorage
 * @returns {Object} Object with preset names as keys and configs as values
 */
function loadPresetsFromStorage() {
    try {
        const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error loading presets:', e);
        return {};
    }
}

/**
 * Loads and displays all saved presets in the UI
 */
function loadPresets() {
    const presets = loadPresetsFromStorage();
    const presetNames = Object.keys(presets);
    
    if (presetNames.length === 0) {
        elements.presetsList.innerHTML = '<p class="no-presets">No presets saved yet. Configure a workout and click "Save Preset" to create one.</p>';
        return;
    }
    
    elements.presetsList.innerHTML = presetNames.map(name => {
        return `
            <div class="preset-item">
                <span class="preset-name" onclick="loadPreset('${name.replace(/'/g, "\\'")}')">${escapeHtml(name)}</span>
                <div class="preset-actions">
                    <button class="btn btn-secondary btn-small" onclick="loadPreset('${name.replace(/'/g, "\\'")}')">Load</button>
                    <button class="btn btn-danger btn-small" onclick="deletePreset('${name.replace(/'/g, "\\'")}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Loads a specific preset into the form
 * @param {string} name - Preset name
 */
function loadPreset(name) {
    const presets = loadPresetsFromStorage();
    
    if (!presets[name]) {
        alert('Preset not found');
        return;
    }
    
    if (workoutState.isRunning) {
        if (!confirm('A workout is in progress. Loading a preset will reset the timer. Continue?')) {
            return;
        }
        resetTimer();
    }
    
    populateFormFromConfig(presets[name]);
    loadConfigFromForm();
}

/**
 * Deletes a preset from localStorage
 * @param {string} name - Preset name
 */
function deletePreset(name) {
    if (!confirm(`Delete preset "${name}"?`)) {
        return;
    }
    
    try {
        const presets = loadPresetsFromStorage();
        delete presets[name];
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
        loadPresets();
    } catch (e) {
        console.error('Error deleting preset:', e);
        alert('Error deleting preset.');
    }
}

/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally for onclick handlers
window.loadPreset = loadPreset;
window.deletePreset = deletePreset;

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Saves current settings to localStorage
 */
function saveSettings() {
    try {
        const settings = {
            soundsEnabled: workoutState.soundsEnabled,
            vibrationEnabled: workoutState.vibrationEnabled,
            darkMode: document.documentElement.getAttribute('data-theme') === 'dark',
            lastConfig: workoutState.config
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('Error saving settings:', e);
    }
}

/**
 * Loads settings from localStorage
 */
function loadSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!stored) return;
        
        const settings = JSON.parse(stored);
        
        // Restore settings
        workoutState.soundsEnabled = settings.soundsEnabled !== undefined ? settings.soundsEnabled : true;
        workoutState.vibrationEnabled = settings.vibrationEnabled !== undefined ? settings.vibrationEnabled : true;
        
        elements.enableSounds.checked = workoutState.soundsEnabled;
        elements.enableVibration.checked = workoutState.vibrationEnabled;
        
        // Restore dark mode
        if (settings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            elements.darkModeToggle.checked = true;
        }
        
        // Restore last config if available
        if (settings.lastConfig) {
            populateFormFromConfig(settings.lastConfig);
            loadConfigFromForm();
        }
    } catch (e) {
        console.warn('Error loading settings:', e);
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Initializes all event listeners
 */
function initEventListeners() {
    // Control buttons
    elements.startBtn.addEventListener('click', () => {
        initAudioContext();
        startTimer();
    });
    
    elements.pauseBtn.addEventListener('click', () => {
        if (workoutState.isPaused) {
            resumeTimer();
        } else {
            pauseTimer();
        }
    });
    
    elements.resetBtn.addEventListener('click', () => {
        if (workoutState.isRunning) {
            if (confirm('Reset the timer? Current progress will be lost.')) {
                resetTimer();
            }
        } else {
            resetTimer();
        }
    });
    
    // Settings toggles
    elements.enableSounds.addEventListener('change', (e) => {
        workoutState.soundsEnabled = e.target.checked;
        if (e.target.checked) {
            initAudioContext();
        }
        saveSettings();
    });
    
    elements.enableVibration.addEventListener('change', (e) => {
        workoutState.vibrationEnabled = e.target.checked;
        saveSettings();
    });
    
    // Dark mode toggle
    elements.darkModeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        saveSettings();
    });
    
    // Save preset button
    elements.savePresetBtn.addEventListener('click', savePreset);
    
    // Save config on form changes (for last-used settings)
    const formInputs = [
        elements.workoutName,
        elements.warmupDuration,
        elements.workDuration,
        elements.restDuration,
        elements.longRestDuration,
        elements.setsPerRound,
        elements.numberOfRounds
    ];
    
    formInputs.forEach(input => {
        input.addEventListener('change', () => {
            loadConfigFromForm();
            saveSettings();
        });
    });
    
    // Initialize audio context on any user interaction
    document.addEventListener('click', () => {
        if (!audioContext) {
            initAudioContext();
        }
    }, { once: true });
    
    document.addEventListener('touchstart', () => {
        if (!audioContext) {
            initAudioContext();
        }
    }, { once: true });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the application
 */
function init() {
    // Load settings and presets
    loadSettings();
    loadPresets();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initialize display
    updateDisplay();
    
    // Initialize audio context if already interacted
    initAudioContext();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

