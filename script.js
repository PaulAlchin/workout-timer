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
        setupDuration: 10,
        warmupDuration: 0,
        workDuration: 30,
        restDuration: 10,
        longRestDuration: 60,
        setsPerRound: 4,
        numberOfRounds: 1
    },
    
    // Workout mode
    workoutMode: 'normal', // 'normal', 'headToHead', or 'stopwatch'
    
    // Current timer state
    currentPhase: 'ready', // 'ready', 'warmup', 'work', 'rest', 'longRest', 'complete'
    currentRound: 0,
    currentSet: 0,
    nextSet: 0, // For rest phases: the next set we're resting before
    currentPerson: 0, // For head-to-head mode: current person number (1-based)
    timeRemaining: 0,
    totalWorkoutTime: 0,
    elapsedTime: 0,
    
    // Stopwatch state
    lapTimes: [], // Array of lap time objects: { lapNumber, time }
    lapStartTime: 0, // Elapsed time when current lap started
    
    // Control state
    intervalId: null,
    isPaused: false,
    isRunning: false,
    isCompleting: false, // Flag to prevent multiple completion dialogs
    isTransitioning: false, // Flag to prevent multiple phase transitions
    wakeLock: null, // Screen wake lock to prevent screen from sleeping
    
    // Phase tracking for transitions
    phaseSequence: [],
    currentPhaseIndex: 0,
    
    // Settings
    soundsEnabled: true,
    vibrationEnabled: true,
    
    // Breathing mode state
    breathingMode: false, // Track if in breathing mode
    breathingConfig: {
        breathIn: 4,
        inhaledHold: 0,
        breathOut: 4,
        exhaledHold: 0
    },
    currentBreathingPhase: 'ready', // 'ready', 'breathIn', 'inhaledHold', 'breathOut', 'exhaledHold'
    breathingTimeRemaining: 0,
    breathingPhaseSequence: [],
    currentBreathingPhaseIndex: 0,
    breathingIntervalId: null,
    breathingIsPaused: false,
    breathingIsRunning: false,
    breathingIsTransitioning: false
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

const elements = {
    // Timer display
    timerSection: document.getElementById('timerSection'),
    phaseIndicator: document.getElementById('phaseIndicator'),
    currentPerson: document.getElementById('currentPerson'),
    timerDisplay: document.getElementById('timerDisplay'),
    roundInfo: document.getElementById('roundInfo'),
    setInfo: document.getElementById('setInfo'),
    progressBar: document.getElementById('progressBar'),
    
    // Controls
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    lapBtn: document.getElementById('lapBtn'),
    resetBtn: document.getElementById('resetBtn'),
    
    // Settings
    enableSounds: document.getElementById('enableSounds'),
    enableVibration: document.getElementById('enableVibration'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    
    // Mode toggle
    normalMode: document.getElementById('normalMode'),
    headToHeadMode: document.getElementById('headToHeadMode'),
    stopwatchMode: document.getElementById('stopwatchMode'),
    normalFormSection: document.getElementById('normalFormSection'),
    headToHeadFormSection: document.getElementById('headToHeadFormSection'),
    
    // Lap times
    lapTimesList: document.getElementById('lapTimesList'),
    
    // Normal form
    workoutForm: document.getElementById('workoutForm'),
    workoutName: document.getElementById('workoutName'),
    setupDuration: document.getElementById('setupDuration'),
    warmupDuration: document.getElementById('warmupDuration'),
    workDuration: document.getElementById('workDuration'),
    restDuration: document.getElementById('restDuration'),
    longRestDuration: document.getElementById('longRestDuration'),
    setsPerRound: document.getElementById('setsPerRound'),
    numberOfRounds: document.getElementById('numberOfRounds'),
    
    // Head-to-head form
    headToHeadForm: document.getElementById('headToHeadForm'),
    workoutNameHeadToHead: document.getElementById('workoutNameHeadToHead'),
    numberOfPeople: document.getElementById('numberOfPeople'),
    workDurationHeadToHead: document.getElementById('workDurationHeadToHead'),
    setupDurationHeadToHead: document.getElementById('setupDurationHeadToHead'),
    numberOfRoundsHeadToHead: document.getElementById('numberOfRoundsHeadToHead'),
    
    // Presets
    savePresetBtn: document.getElementById('savePresetBtn'),
    savePresetHeadToHeadBtn: document.getElementById('savePresetHeadToHeadBtn'),
    presetsList: document.getElementById('presetsList'),
    
    // Tab navigation
    workoutTab: document.getElementById('workoutTab'),
    breathingTab: document.getElementById('breathingTab'),
    workoutContent: document.getElementById('workoutContent'),
    breathingContent: document.getElementById('breathingContent'),
    
    // Breathing elements
    breathingSection: document.querySelector('#breathingContent .breathing-section'),
    breathingPhaseIndicator: document.getElementById('breathingPhaseIndicator'),
    breathingTimerDisplay: document.getElementById('breathingTimerDisplay'),
    breathingCircle: document.getElementById('breathingCircle'),
    breathingPhaseLabel: document.getElementById('breathingPhaseLabel'),
    breathingStartBtn: document.getElementById('breathingStartBtn'),
    breathingPauseBtn: document.getElementById('breathingPauseBtn'),
    breathingResetBtn: document.getElementById('breathingResetBtn'),
    breathInTime: document.getElementById('breathInTime'),
    inhaledHoldTime: document.getElementById('inhaledHoldTime'),
    breathOutTime: document.getElementById('breathOutTime'),
    exhaledHoldTime: document.getElementById('exhaledHoldTime'),
    
    // Breathing preset elements
    breathingCategory: document.getElementById('breathingCategory'),
    breathingPreset: document.getElementById('breathingPreset'),
    breathingPresetInfo: document.getElementById('breathingPresetInfo'),
    breathingPresetDescription: document.getElementById('breathingPresetDescription'),
    breathingPresetUseCase: document.getElementById('breathingPresetUseCase'),
    breathingPresetName: document.getElementById('breathingPresetName'),
    saveBreathingPresetBtn: document.getElementById('saveBreathingPresetBtn'),
    breathingPresetsList: document.getElementById('breathingPresetsList')
};

// ============================================================================
// TIMER ENGINE
// ============================================================================

/**
 * Color palette for different people in head-to-head mode
 * Colors cycle through this array (person 11 uses person 1's color, etc.)
 */
const PERSON_COLORS = [
    '#4CAF50', // Person 1: Green
    '#2196F3', // Person 2: Blue
    '#FF9800', // Person 3: Orange
    '#9C27B0', // Person 4: Purple
    '#F44336', // Person 5: Red
    '#009688', // Person 6: Teal
    '#E91E63', // Person 7: Pink
    '#FFC107', // Person 8: Amber
    '#3F51B5', // Person 9: Indigo
    '#00BCD4'  // Person 10: Cyan
];

/**
 * Gets the color for a specific person number in head-to-head mode
 * @param {number} personNumber - The person number (1-based)
 * @returns {string} Hex color code
 */
function getPersonColor(personNumber) {
    if (personNumber < 1) return PERSON_COLORS[0];
    // Cycle through colors (person 11 uses person 1's color, etc.)
    const index = (personNumber - 1) % PERSON_COLORS.length;
    return PERSON_COLORS[index];
}

/**
 * Builds the head-to-head rotation phase sequence
 * Each round: all people work consecutively with no rest
 */
function buildHeadToHeadSequence() {
    const sequence = [];
    const config = workoutState.config;
    
    // Add setup phase before first round if duration > 0
    if (config.setupDuration > 0) {
        sequence.push({
            type: 'setup',
            duration: config.setupDuration,
            round: 0,
            person: 0,
            set: 0
        });
    }
    
    // Build rounds
    for (let round = 1; round <= config.numberOfRounds; round++) {
        // Add work phase for each person
        for (let person = 1; person <= config.numberOfPeople; person++) {
            sequence.push({
                type: 'work',
                duration: config.workDuration,
                round: round,
                person: person,
                set: 0 // Not used in head-to-head mode
            });
        }
        // No rest between people or rounds in head-to-head mode
    }
    
    workoutState.phaseSequence = sequence;
    workoutState.currentPhaseIndex = 0;
    
    // Calculate total workout time
    workoutState.totalWorkoutTime = sequence.reduce((sum, phase) => sum + phase.duration, 0);
    
    // Debug: log the phase sequence
    console.log('Head-to-head phase sequence built:', sequence.length, 'phases');
    console.log('Sequence:', sequence.map((p, i) => `${i}: ${p.type} R${p.round} P${p.person}`).join(', '));
}

/**
 * Builds the phase sequence array based on workout configuration
 * Phase sequence: setup (if > 0) → warmup (if > 0) → [round: (work → rest)*sets → longRest]*rounds
 */
function buildPhaseSequence() {
    const sequence = [];
    const config = workoutState.config;
    
    // Add setup phase before warmup if duration > 0
    if (config.setupDuration > 0) {
        sequence.push({
            type: 'setup',
            duration: config.setupDuration,
            round: 0,
            set: 0
        });
    }
    
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
    
    // Handle stopwatch mode differently
    if (workoutState.workoutMode === 'stopwatch') {
        startStopwatch();
        return;
    }
    
    // Load configuration from form based on mode
    loadConfigFromForm();
    
    // Validate configuration based on mode
    if (workoutState.workoutMode === 'headToHead') {
        if (workoutState.config.workDuration <= 0) {
            alert('Work duration must be greater than 0');
            return;
        }
        if (workoutState.config.numberOfPeople <= 0 || workoutState.config.numberOfRounds <= 0) {
            alert('Number of people and number of rounds must be greater than 0');
            return;
        }
    } else {
        if (workoutState.config.workDuration <= 0) {
            alert('Work duration must be greater than 0');
            return;
        }
        if (workoutState.config.setsPerRound <= 0 || workoutState.config.numberOfRounds <= 0) {
            alert('Sets per round and number of rounds must be greater than 0');
            return;
        }
    }
    
    // Build phase sequence based on mode
    if (workoutState.workoutMode === 'headToHead') {
        buildHeadToHeadSequence();
    } else {
        buildPhaseSequence();
    }
    
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
    if (workoutState.workoutMode === 'stopwatch') {
        elements.lapBtn.style.display = 'inline-block';
    } else {
        elements.lapBtn.style.display = 'none';
    }
    elements.resetBtn.disabled = false;
    
    // Disable form inputs during workout
    disableFormInputs(true);
    
    // Request screen wake lock to prevent device from sleeping
    requestWakeLock();
    
    // Start the interval
    workoutState.intervalId = setInterval(updateTimer, 10);
    
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
    workoutState.currentSet = phase.set || 0;
    workoutState.nextSet = phase.nextSet || 0; // Store next set for rest phases
    workoutState.currentPerson = phase.person || 0; // Store current person for head-to-head mode
    
    // Debug log
    if (workoutState.workoutMode === 'headToHead') {
        console.log(`Phase ${workoutState.currentPhaseIndex}: ${phase.type}, Round ${workoutState.currentRound}, Person ${workoutState.currentPerson}`);
    } else {
        console.log(`Phase ${workoutState.currentPhaseIndex}: ${phase.type}, Round ${workoutState.currentRound}, Set ${workoutState.currentSet}${workoutState.nextSet ? ', Next: ' + workoutState.nextSet : ''}`);
    }
    
    updateDisplay();
}

/**
 * Starts the stopwatch
 */
function startStopwatch() {
    // Initialize stopwatch state
    workoutState.isRunning = true;
    workoutState.isPaused = false;
    workoutState.elapsedTime = workoutState.elapsedTime || 0; // Preserve elapsed time if resuming
    workoutState.lapStartTime = workoutState.elapsedTime; // Set lap start time
    
    // Update UI
    elements.startBtn.style.display = 'none';
    elements.pauseBtn.style.display = 'inline-block';
    elements.lapBtn.style.display = 'inline-block';
    elements.resetBtn.disabled = false;
    
    // Request screen wake lock
    requestWakeLock();
    
    // Start the interval
    workoutState.intervalId = setInterval(updateTimer, 10);
    
    // Play start sound
    playBeep('start');
    vibrate([100]);
}

/**
 * Main timer update function - called every 10ms
 */
function updateTimer() {
    if (!workoutState.isRunning || workoutState.isPaused || workoutState.isTransitioning) {
        return;
    }
    
    // Handle stopwatch mode (count up)
    if (workoutState.workoutMode === 'stopwatch') {
        workoutState.elapsedTime += 0.01;
        updateDisplay();
        return;
    }
    
    // Check if phase is complete BEFORE updating time (to prevent multiple transitions)
    const wasComplete = workoutState.timeRemaining <= 0;
    
    if (!wasComplete) {
        workoutState.timeRemaining -= 0.01;
        workoutState.elapsedTime += 0.01;
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
                
                // Head-to-head mode: sound and vibration when switching to next person
                if (workoutState.workoutMode === 'headToHead' && nextPhase.type === 'work') {
                    playBeep('end'); // Beep for person transition
                    vibrate([100]); // Vibration for person transition
                } else if (workoutState.workoutMode === 'normal') {
                    // Normal mode: different sound for round start
                    if (nextPhase.type === 'work' && nextPhase.set === 1 && nextPhase.round > workoutState.currentRound) {
                        playBeep('roundStart');
                        vibrate([200, 100, 200]);
                    }
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
 * Records a lap time for stopwatch mode
 */
function recordLap() {
    if (workoutState.workoutMode !== 'stopwatch' || !workoutState.isRunning) {
        return;
    }
    
    const lapNumber = workoutState.lapTimes.length + 1;
    const lapTime = workoutState.elapsedTime;
    
    // Calculate lap duration (time since last lap or start)
    const lapDuration = lapTime - workoutState.lapStartTime;
    
    // Store lap information
    workoutState.lapTimes.push({
        lapNumber: lapNumber,
        time: lapTime,
        lapDuration: lapDuration
    });
    
    // Update lap start time for next lap
    workoutState.lapStartTime = lapTime;
    
    // Update display
    displayLapTimes();
    
    // Play lap sound
    playBeep('end');
    vibrate([50]);
}

/**
 * Displays the list of recorded lap times
 */
function displayLapTimes() {
    if (!elements.lapTimesList) {
        return;
    }
    
    if (workoutState.lapTimes.length === 0) {
        elements.lapTimesList.innerHTML = '';
        return;
    }
    
    // Build HTML for lap times with millisecond formatting
    const lapItems = workoutState.lapTimes.map(lap => {
        return `
            <div class="lap-item">
                <span class="lap-number">Lap ${lap.lapNumber}</span>
                <span class="lap-time">${formatTimeWithMilliseconds(lap.time)}</span>
                <span class="lap-duration">${formatTimeWithMilliseconds(lap.lapDuration)}</span>
            </div>
        `;
    }).join('');
    
    elements.lapTimesList.innerHTML = lapItems;
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
    
    // Release screen wake lock
    releaseWakeLock();
    
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
    workoutState.currentPerson = 0;
    workoutState.timeRemaining = 0;
    workoutState.elapsedTime = 0;
    
    // Reset stopwatch-specific state
    workoutState.lapTimes = [];
    workoutState.lapStartTime = 0;
    
    // Update UI
    elements.startBtn.style.display = 'inline-block';
    elements.pauseBtn.style.display = 'none';
    elements.pauseBtn.textContent = 'Pause';
    elements.lapBtn.style.display = 'none';
    elements.resetBtn.disabled = false;
    
    // Enable form inputs
    disableFormInputs(false);
    
    // Reset display
    updateDisplay();
    
    // Clear lap times display
    if (workoutState.workoutMode === 'stopwatch') {
        displayLapTimes();
    }
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
    
    // Release screen wake lock
    releaseWakeLock();
    
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
// BREATHING TIMER ENGINE
// ============================================================================

/**
 * Builds the breathing phase sequence array
 * Sequence: breathIn → inhaledHold → breathOut → exhaledHold (loops)
 */
function buildBreathingSequence() {
    const sequence = [];
    const config = workoutState.breathingConfig;
    
    // Only add phases with duration > 0
    if (config.breathIn > 0) {
        sequence.push({
            type: 'breathIn',
            duration: config.breathIn
        });
    }
    
    if (config.inhaledHold > 0) {
        sequence.push({
            type: 'inhaledHold',
            duration: config.inhaledHold
        });
    }
    
    if (config.breathOut > 0) {
        sequence.push({
            type: 'breathOut',
            duration: config.breathOut
        });
    }
    
    if (config.exhaledHold > 0) {
        sequence.push({
            type: 'exhaledHold',
            duration: config.exhaledHold
        });
    }
    
    workoutState.breathingPhaseSequence = sequence;
    workoutState.currentBreathingPhaseIndex = 0;
    
    if (sequence.length === 0) {
        console.warn('No breathing phases configured');
    }
}

/**
 * Loads breathing configuration from form inputs
 */
function loadBreathingConfigFromForm() {
    workoutState.breathingConfig = {
        breathIn: parseInt(elements.breathInTime.value) || 4,
        inhaledHold: parseInt(elements.inhaledHoldTime.value) || 0,
        breathOut: parseInt(elements.breathOutTime.value) || 4,
        exhaledHold: parseInt(elements.exhaledHoldTime.value) || 0
    };
}

/**
 * Starts the breathing timer
 */
function startBreathingTimer() {
    // Check if user has interacted (required for audio)
    if (!workoutState.hasInteracted) {
        workoutState.hasInteracted = true;
    }
    
    // Load configuration from form
    loadBreathingConfigFromForm();
    
    // Validate configuration
    if (workoutState.breathingConfig.breathIn <= 0 && workoutState.breathingConfig.breathOut <= 0) {
        alert('Breath in or breath out time must be greater than 0');
        return;
    }
    
    // Build phase sequence
    buildBreathingSequence();
    
    if (workoutState.breathingPhaseSequence.length === 0) {
        alert('Invalid breathing configuration');
        return;
    }
    
    // Initialize breathing timer state
    workoutState.breathingIsRunning = true;
    workoutState.breathingIsPaused = false;
    workoutState.currentBreathingPhaseIndex = 0;
    workoutState.breathingIsTransitioning = false;
    
    // Load first phase
    loadBreathingPhase();
    
    // Update UI
    if (elements.breathingStartBtn) elements.breathingStartBtn.style.display = 'none';
    if (elements.breathingPauseBtn) elements.breathingPauseBtn.style.display = 'inline-block';
    if (elements.breathingResetBtn) elements.breathingResetBtn.disabled = false;
    
    // Disable form inputs during breathing
    disableBreathingInputs(true);
    
    // Request screen wake lock
    requestWakeLock();
    
    // Start the interval
    workoutState.breathingIntervalId = setInterval(updateBreathingTimer, 10);
    
    // Play start sound
    playBeep('start');
    vibrate([100]);
}

/**
 * Loads the current breathing phase from the phase sequence
 */
function loadBreathingPhase() {
    // Validate index
    if (workoutState.currentBreathingPhaseIndex < 0 || workoutState.currentBreathingPhaseIndex >= workoutState.breathingPhaseSequence.length) {
        // Loop back to start for continuous breathing
        workoutState.currentBreathingPhaseIndex = 0;
    }
    
    const phase = workoutState.breathingPhaseSequence[workoutState.currentBreathingPhaseIndex];
    
    if (!phase) {
        console.error('Breathing phase not found at index:', workoutState.currentBreathingPhaseIndex);
        resetBreathingTimer();
        return;
    }
    
    workoutState.currentBreathingPhase = phase.type;
    workoutState.breathingTimeRemaining = phase.duration;
    
    // Debug log
    console.log(`Breathing Phase ${workoutState.currentBreathingPhaseIndex}: ${phase.type}, Duration: ${phase.duration}s`);
    
    updateBreathingDisplay();
}

/**
 * Main breathing timer update function - called every 10ms
 */
function updateBreathingTimer() {
    if (!workoutState.breathingIsRunning || workoutState.breathingIsPaused || workoutState.breathingIsTransitioning) {
        return;
    }
    
    // Check if phase is complete BEFORE updating time (to prevent multiple transitions)
    const wasComplete = workoutState.breathingTimeRemaining <= 0;
    
    if (!wasComplete) {
        workoutState.breathingTimeRemaining -= 0.01;
    }
    
    // Clamp time to 0 if negative
    if (workoutState.breathingTimeRemaining < 0) {
        workoutState.breathingTimeRemaining = 0;
    }
    
    // Update display
    updateBreathingDisplay();
    
    // Check if phase is complete (only once per phase)
    if (!wasComplete && workoutState.breathingTimeRemaining <= 0) {
        // Prevent multiple transitions
        workoutState.breathingIsTransitioning = true;
        
        // Play completion sound
        playBeep('end');
        vibrate([100]);
        
        // Move to next phase (loop continuously)
        const nextIndex = (workoutState.currentBreathingPhaseIndex + 1) % workoutState.breathingPhaseSequence.length;
        
        // Small delay before next phase transition
        setTimeout(() => {
            // Check if still running (not paused/reset during delay)
            if (!workoutState.breathingIsRunning) {
                workoutState.breathingIsTransitioning = false;
                return;
            }
            
            // Update index
            workoutState.currentBreathingPhaseIndex = nextIndex;
            
            // Clear the transition flag
            workoutState.breathingIsTransitioning = false;
            
            loadBreathingPhase();
        }, 500);
    }
}

/**
 * Pauses the breathing timer
 */
function pauseBreathingTimer() {
    if (!workoutState.breathingIsRunning) return;
    
    workoutState.breathingIsPaused = true;
    if (elements.breathingPauseBtn) elements.breathingPauseBtn.textContent = 'Resume';
}

/**
 * Resumes the breathing timer
 */
function resumeBreathingTimer() {
    if (!workoutState.breathingIsRunning) return;
    
    workoutState.breathingIsPaused = false;
    if (elements.breathingPauseBtn) elements.breathingPauseBtn.textContent = 'Pause';
}

/**
 * Resets the breathing timer to initial state
 */
function resetBreathingTimer() {
    // Clear interval
    if (workoutState.breathingIntervalId) {
        clearInterval(workoutState.breathingIntervalId);
        workoutState.breathingIntervalId = null;
    }
    
    // Release screen wake lock
    releaseWakeLock();
    
    // Reset state
    workoutState.breathingIsRunning = false;
    workoutState.breathingIsPaused = false;
    workoutState.breathingIsTransitioning = false;
    workoutState.currentBreathingPhase = 'ready';
    workoutState.currentBreathingPhaseIndex = 0;
    workoutState.breathingTimeRemaining = 0;
    
    // Update UI
    if (elements.breathingStartBtn) elements.breathingStartBtn.style.display = 'inline-block';
    if (elements.breathingPauseBtn) {
        elements.breathingPauseBtn.style.display = 'none';
        elements.breathingPauseBtn.textContent = 'Pause';
    }
    if (elements.breathingResetBtn) elements.breathingResetBtn.disabled = false;
    
    // Enable form inputs
    disableBreathingInputs(false);
    
    // Reset display
    updateBreathingDisplay();
}

/**
 * Disables or enables breathing form inputs
 */
function disableBreathingInputs(disable) {
    const inputs = [
        elements.breathInTime,
        elements.inhaledHoldTime,
        elements.breathOutTime,
        elements.exhaledHoldTime
    ];
    inputs.forEach(input => {
        if (input) input.disabled = disable;
    });
}

// ============================================================================
// UI UPDATES
// ============================================================================

/**
 * Formats time in seconds to MM:SS.mm format (minutes:seconds.centiseconds)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTimeWithMilliseconds(seconds) {
    const totalSeconds = Math.max(0, seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((totalSeconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/**
 * Updates the timer display, phase indicator, and progress information
 */
function updateDisplay() {
    // Handle stopwatch mode display
    if (workoutState.workoutMode === 'stopwatch') {
        // Display elapsed time counting up with milliseconds
        elements.timerDisplay.textContent = formatTimeWithMilliseconds(workoutState.elapsedTime);
        
        // Update phase indicator
        elements.phaseIndicator.textContent = 'Stopwatch';
        
        // Update phase styling
        elements.timerSection.className = 'timer-section phase-stopwatch';
        
        // Hide progress info elements for stopwatch
        elements.roundInfo.textContent = '';
        elements.setInfo.textContent = '';
        elements.currentPerson.style.display = 'none';
        
        // Hide progress bar for stopwatch
        elements.progressBar.style.width = '0%';
        
        return;
    }
    
    // Update timer display - clamp to 0 to prevent negative display
    if (workoutState.currentPhase === 'ready' || workoutState.currentPhase === 'complete') {
        elements.timerDisplay.textContent = '00:00.00';
    } else {
        elements.timerDisplay.textContent = formatTimeWithMilliseconds(workoutState.timeRemaining);
    }
    
    // Update phase indicator
    const phaseLabels = {
        'ready': 'Ready',
        'setup': 'Setup',
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
    
    // Head-to-head mode display
    if (workoutState.workoutMode === 'headToHead') {
        // Apply person-specific color for work phases
        if (workoutState.currentPhase === 'work' && workoutState.currentPerson > 0) {
            const personColor = getPersonColor(workoutState.currentPerson);
            elements.timerSection.style.backgroundColor = personColor;
        } else {
            // Reset to default phase color
            elements.timerSection.style.backgroundColor = '';
        }
        
        // Show/hide current person display
        if (workoutState.currentPhase === 'work' && workoutState.currentPerson > 0) {
            elements.currentPerson.style.display = 'block';
            elements.currentPerson.textContent = `Person ${workoutState.currentPerson}`;
        } else {
            elements.currentPerson.style.display = 'none';
        }
        
        // Update round and person info
        if (workoutState.currentPhase === 'complete') {
            elements.roundInfo.textContent = 'Workout Complete!';
            elements.setInfo.textContent = '';
        } else if (workoutState.currentRound > 0) {
            elements.roundInfo.textContent = `Round ${workoutState.currentRound} of ${workoutState.config.numberOfRounds}`;
            if (workoutState.currentPerson > 0) {
                elements.setInfo.textContent = `Person ${workoutState.currentPerson} of ${workoutState.config.numberOfPeople}`;
            } else {
                elements.setInfo.textContent = '';
            }
        } else {
            elements.roundInfo.textContent = '';
            elements.setInfo.textContent = '';
        }
    } else {
        // Normal mode display
        elements.currentPerson.style.display = 'none';
        
        if (workoutState.currentPhase === 'setup' || workoutState.currentPhase === 'warmup') {
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
 * Updates the breathing timer display and graphic
 */
function updateBreathingDisplay() {
    // Update timer display
    if (workoutState.currentBreathingPhase === 'ready') {
        if (elements.breathingTimerDisplay) {
            elements.breathingTimerDisplay.textContent = '00:00.00';
        }
    } else {
        if (elements.breathingTimerDisplay) {
            elements.breathingTimerDisplay.textContent = formatTimeWithMilliseconds(workoutState.breathingTimeRemaining);
        }
    }
    
    // Update phase indicator
    const phaseLabels = {
        'ready': 'Ready',
        'breathIn': 'Breath In',
        'inhaledHold': 'Hold',
        'breathOut': 'Breath Out',
        'exhaledHold': 'Hold'
    };
    
    if (elements.breathingPhaseIndicator) {
        elements.breathingPhaseIndicator.textContent = phaseLabels[workoutState.currentBreathingPhase] || 'Ready';
    }
    
    // Update phase styling
    if (elements.breathingSection) {
        elements.breathingSection.className = 'breathing-section';
        if (workoutState.currentBreathingPhase !== 'ready') {
            elements.breathingSection.classList.add(`phase-${workoutState.currentBreathingPhase}`);
        }
        // Ensure section has overflow hidden to prevent layout shifts
        elements.breathingSection.style.overflow = 'hidden';
        elements.breathingSection.style.position = 'relative';
    }
    
    // Update graphic
    updateBreathingGraphic();
}

/**
 * Updates the breathing circle graphic based on current phase and progress
 */
function updateBreathingGraphic() {
    if (!elements.breathingCircle || !elements.breathingPhaseLabel) {
        return;
    }
    
    // Ensure container is set up correctly to prevent layout shifts
    const container = elements.breathingCircle.parentElement;
    if (container && container.classList.contains('breathing-graphic-container')) {
        container.style.position = 'relative';
        container.style.flexShrink = '0';
    }
    
    const phase = workoutState.currentBreathingPhase;
    const phaseLabels = {
        'ready': 'Ready',
        'breathIn': 'Breathe In',
        'inhaledHold': 'Hold',
        'breathOut': 'Breathe Out',
        'exhaledHold': 'Hold'
    };
    
    // Update phase label
    elements.breathingPhaseLabel.textContent = phaseLabels[phase] || 'Ready';
    
    // Calculate circle size based on phase and progress
    let circleSize = 130; // Base size in pixels
    const maxSize = 280; // Maximum size when fully expanded
    const minSize = 130; // Minimum size when fully contracted (increased to prevent text wrapping)
    
    if (phase === 'breathIn') {
        // Expand during breath in
        const phaseDuration = workoutState.breathingPhaseSequence[workoutState.currentBreathingPhaseIndex]?.duration || 4;
        const progress = 1 - (workoutState.breathingTimeRemaining / phaseDuration);
        circleSize = minSize + (maxSize - minSize) * progress;
    } else if (phase === 'inhaledHold') {
        // Stay large during inhaled hold
        circleSize = maxSize;
    } else if (phase === 'breathOut') {
        // Contract during breath out
        const phaseDuration = workoutState.breathingPhaseSequence[workoutState.currentBreathingPhaseIndex]?.duration || 4;
        const progress = 1 - (workoutState.breathingTimeRemaining / phaseDuration);
        circleSize = maxSize - (maxSize - minSize) * progress;
    } else if (phase === 'exhaledHold') {
        // Stay small during exhaled hold
        circleSize = minSize;
    } else {
        // Ready state - medium size
        circleSize = 130;
    }
    
    // Apply size to circle
    elements.breathingCircle.style.width = `${circleSize}px`;
    elements.breathingCircle.style.height = `${circleSize}px`;
    
    // Set background color based on phase (pastel purple for ready, phase colors for active phases)
    const phaseColors = {
        'ready': '#C8A8E9',      // Pastel purple
        'breathIn': '#2196F3',   // Blue
        'inhaledHold': '#4CAF50', // Green
        'breathOut': '#FF9800',   // Orange
        'exhaledHold': '#9C27B0'  // Purple
    };
    elements.breathingCircle.style.backgroundColor = phaseColors[phase] || '#C8A8E9';
    
    // Ensure circle is absolutely positioned to prevent layout shifts
    elements.breathingCircle.style.position = 'absolute';
    elements.breathingCircle.style.top = '50%';
    elements.breathingCircle.style.left = '50%';
    elements.breathingCircle.style.transform = 'translate(-50%, -50%)';
    elements.breathingCircle.style.margin = '0';
}

/**
 * Disables or enables form inputs based on current mode
 */
function disableFormInputs(disable) {
    // Stopwatch mode doesn't have form inputs
    if (workoutState.workoutMode === 'stopwatch') {
        return;
    }
    
    if (workoutState.workoutMode === 'headToHead') {
        const inputs = [
            elements.workoutNameHeadToHead,
            elements.setupDurationHeadToHead,
            elements.numberOfPeople,
            elements.workDurationHeadToHead,
            elements.numberOfRoundsHeadToHead,
            elements.savePresetHeadToHeadBtn
        ];
        inputs.forEach(input => {
            if (input) input.disabled = disable;
        });
    } else {
        const inputs = [
            elements.workoutName,
            elements.setupDuration,
            elements.warmupDuration,
            elements.workDuration,
            elements.restDuration,
            elements.longRestDuration,
            elements.setsPerRound,
            elements.numberOfRounds,
            elements.savePresetBtn
        ];
        inputs.forEach(input => {
            if (input) input.disabled = disable;
        });
    }
}

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Loads configuration from form inputs based on current mode
 */
function loadConfigFromForm() {
    if (workoutState.workoutMode === 'headToHead') {
        workoutState.config = {
            workoutName: elements.workoutNameHeadToHead.value.trim(),
            setupDuration: parseInt(elements.setupDurationHeadToHead.value) || 10,
            workDuration: parseInt(elements.workDurationHeadToHead.value) || 30,
            numberOfPeople: parseInt(elements.numberOfPeople.value) || 3,
            numberOfRounds: parseInt(elements.numberOfRoundsHeadToHead.value) || 1,
            // Not used in head-to-head mode
            warmupDuration: 0,
            restDuration: 0,
            longRestDuration: 0,
            setsPerRound: 0
        };
    } else {
        workoutState.config = {
            workoutName: elements.workoutName.value.trim(),
            setupDuration: parseInt(elements.setupDuration.value) || 10,
            warmupDuration: parseInt(elements.warmupDuration.value) || 0,
            workDuration: parseInt(elements.workDuration.value) || 30,
            restDuration: parseInt(elements.restDuration.value) || 0,
            longRestDuration: parseInt(elements.longRestDuration.value) || 0,
            setsPerRound: parseInt(elements.setsPerRound.value) || 1,
            numberOfRounds: parseInt(elements.numberOfRounds.value) || 1,
            // Not used in normal mode
            numberOfPeople: 0
        };
    }
}

/**
 * Populates form inputs from configuration object based on mode
 */
function populateFormFromConfig(config, mode) {
    if (mode === 'headToHead') {
        elements.workoutNameHeadToHead.value = config.workoutName || '';
        elements.setupDurationHeadToHead.value = config.setupDuration !== undefined ? config.setupDuration : 10;
        elements.workDurationHeadToHead.value = config.workDuration || 30;
        elements.numberOfPeople.value = config.numberOfPeople || 3;
        elements.numberOfRoundsHeadToHead.value = config.numberOfRounds || 1;
    } else {
        elements.workoutName.value = config.workoutName || '';
        elements.setupDuration.value = config.setupDuration !== undefined ? config.setupDuration : 10;
        elements.warmupDuration.value = config.warmupDuration || 0;
        elements.workDuration.value = config.workDuration || 30;
        elements.restDuration.value = config.restDuration || 0;
        elements.longRestDuration.value = config.longRestDuration || 0;
        elements.setsPerRound.value = config.setsPerRound || 1;
        elements.numberOfRounds.value = config.numberOfRounds || 1;
    }
}

// ============================================================================
// SOUND & VIBRATION
// ============================================================================

let audioContext = null;

/**
 * Initializes the audio context (must be called after user interaction)
 */
async function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Audio context not supported:', e);
            return;
        }
    }
    
    // iOS Safari requires audio to be "unlocked" by playing a sound in the user interaction
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            // Unlock audio by playing a silent sound immediately (must be in user interaction)
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 1; // Very low frequency
            gainNode.gain.setValueAtTime(0.001, audioContext.currentTime); // Very quiet
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.01); // Very short
        } catch (e) {
            console.warn('Could not unlock audio:', e);
        }
    }
}

/**
 * Plays a beep sound using Web Audio API
 * @param {string} type - 'start', 'end', 'roundStart', 'complete'
 */
async function playBeep(type = 'end') {
    if (!workoutState.soundsEnabled || !audioContext) {
        return;
    }
    
    try {
        // iOS Safari requires AudioContext to be resumed if suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
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
            setTimeout(async () => {
                // Ensure AudioContext is still running
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
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
// SCREEN WAKE LOCK
// ============================================================================

/**
 * Requests a screen wake lock to prevent the device from sleeping
 */
async function requestWakeLock() {
    // Check if wake lock API is available
    if (!('wakeLock' in navigator)) {
        console.log('Screen Wake Lock API not supported in this browser');
        // On iOS, provide helpful message
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                                 window.navigator.standalone === true;
            if (!isStandalone) {
                console.log('iOS: To prevent screen from sleeping, add this app to your home screen and open it from there.');
            }
        }
        return;
    }
    
    // Check if running in standalone/PWA mode on iOS (required for wake lock)
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true ||
                         document.referrer.includes('android-app://');
    
    if (isIOS && !isStandalone) {
        console.warn('iOS: Wake Lock only works when app is added to home screen and opened from there');
        console.log('Please add this app to your home screen: Safari menu → Share → Add to Home Screen');
        return;
    }
    
    try {
        // Release any existing wake lock first
        if (workoutState.wakeLock) {
            await releaseWakeLock();
        }
        
        // Request wake lock
        workoutState.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen wake lock acquired successfully');
        
        // Handle wake lock release (e.g., if user switches tabs or device locks)
        workoutState.wakeLock.addEventListener('release', () => {
            console.log('Screen wake lock released');
            workoutState.wakeLock = null;
        });
        
    } catch (err) {
        // Wake lock request failed (e.g., user denied permission, or already active)
        console.warn('Screen wake lock request failed:', err.name, err.message);
        workoutState.wakeLock = null;
    }
}

/**
 * Releases the screen wake lock
 */
async function releaseWakeLock() {
    if (workoutState.wakeLock) {
        try {
            await workoutState.wakeLock.release();
            workoutState.wakeLock = null;
            console.log('Screen wake lock released');
        } catch (err) {
            console.warn('Error releasing wake lock:', err);
            workoutState.wakeLock = null;
        }
    }
}

/**
 * Handles page visibility changes to reacquire wake lock if needed
 */
async function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        // Page became visible again - reacquire wake lock if timer is running
        if (workoutState.isRunning && !workoutState.isPaused) {
            await requestWakeLock();
        }
    }
}

// ============================================================================
// PRESETS SYSTEM
// ============================================================================

const PRESETS_STORAGE_KEY = 'workoutTimer_presets';
const SETTINGS_STORAGE_KEY = 'workoutTimer_settings';
const BREATHING_PRESETS_STORAGE_KEY = 'workoutTimer_breathingPresets';

/**
 * Built-in breathing presets organized by category
 */
const BUILT_IN_BREATHING_PRESETS = {
    'Calming': [
        {
            category: 'Calming',
            name: 'Box Breathing',
            breathIn: 4,
            inhaledHold: 4,
            breathOut: 4,
            exhaledHold: 4,
            description: 'Stress reduction, emotional control',
            useCase: 'Anxiety, grounding'
        },
        {
            category: 'Calming',
            name: 'Relaxed Box',
            breathIn: 5,
            inhaledHold: 5,
            breathOut: 5,
            exhaledHold: 5,
            description: 'Deep calming',
            useCase: 'Meditation, nervous system reset'
        },
        {
            category: 'Calming',
            name: '4-6 Breathing',
            breathIn: 4,
            inhaledHold: 0,
            breathOut: 6,
            exhaledHold: 0,
            description: 'Relaxation',
            useCase: 'Mild stress, beginners'
        },
        {
            category: 'Calming',
            name: 'Extended Exhale',
            breathIn: 4,
            inhaledHold: 0,
            breathOut: 8,
            exhaledHold: 0,
            description: 'Strong calming',
            useCase: 'Panic, acute stress'
        }
    ],
    'Focus': [
        {
            category: 'Focus',
            name: 'Focus Box',
            breathIn: 5,
            inhaledHold: 5,
            breathOut: 5,
            exhaledHold: 5,
            description: 'Concentration',
            useCase: 'Work, studying'
        },
        {
            category: 'Focus',
            name: 'Tactical Focus',
            breathIn: 4,
            inhaledHold: 4,
            breathOut: 6,
            exhaledHold: 2,
            description: 'Calm alertness',
            useCase: 'Performance, decision-making'
        },
        {
            category: 'Focus',
            name: 'Equal Breathing',
            breathIn: 6,
            inhaledHold: 0,
            breathOut: 6,
            exhaledHold: 0,
            description: 'Mental balance',
            useCase: 'Sustained focus'
        }
    ],
    'Energizing': [
        {
            category: 'Energizing',
            name: 'Stimulating Breath',
            breathIn: 6,
            inhaledHold: 0,
            breathOut: 4,
            exhaledHold: 0,
            description: 'Increased energy',
            useCase: 'Fatigue, low motivation'
        },
        {
            category: 'Energizing',
            name: 'Wake-Up Rhythm',
            breathIn: 4,
            inhaledHold: 2,
            breathOut: 4,
            exhaledHold: 0,
            description: 'Gentle activation',
            useCase: 'Morning use'
        },
        {
            category: 'Energizing',
            name: 'Power Breathing',
            breathIn: 5,
            inhaledHold: 5,
            breathOut: 3,
            exhaledHold: 2,
            description: 'Readiness, alertness',
            useCase: 'Pre-task activation'
        }
    ],
    'Sleep': [
        {
            category: 'Sleep',
            name: '4-7-8 Breathing',
            breathIn: 4,
            inhaledHold: 7,
            breathOut: 8,
            exhaledHold: 0,
            description: 'Sleep induction',
            useCase: 'Falling asleep'
        },
        {
            category: 'Sleep',
            name: 'Slow Drift',
            breathIn: 6,
            inhaledHold: 2,
            breathOut: 8,
            exhaledHold: 2,
            description: 'Deep relaxation',
            useCase: 'Wind-down, meditation'
        },
        {
            category: 'Sleep',
            name: 'Long Exhale Sleep',
            breathIn: 4,
            inhaledHold: 0,
            breathOut: 10,
            exhaledHold: 0,
            description: 'Nervous system downshift',
            useCase: 'Insomnia, racing mind'
        }
    ]
};

/**
 * Saves a workout preset to localStorage
 */
function savePreset() {
    loadConfigFromForm();
    
    const workoutName = workoutState.config.workoutName;
    if (!workoutName) {
        const nameField = workoutState.workoutMode === 'headToHead' 
            ? elements.workoutNameHeadToHead 
            : elements.workoutName;
        alert('Please enter a workout name to save as preset');
        if (nameField) nameField.focus();
        return;
    }
    
    try {
        const presets = loadPresetsFromStorage();
        presets[workoutName] = { 
            ...workoutState.config,
            mode: workoutState.workoutMode // Include mode in preset
        };
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
        
        loadPresets();
        alert(`Preset "${workoutName}" saved!`);
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
        const preset = presets[name];
        const modeLabel = preset.mode === 'headToHead' ? ' (Head-to-Head)' : ' (Normal)';
        return `
            <div class="preset-item">
                <span class="preset-name" onclick="loadPreset('${name.replace(/'/g, "\\'")}')">${escapeHtml(name)}${modeLabel}</span>
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
    
    const preset = presets[name];
    const presetMode = preset.mode || 'normal'; // Default to normal mode for old presets
    
    // Switch to the preset's mode
    workoutState.workoutMode = presetMode;
    if (presetMode === 'headToHead') {
        elements.headToHeadMode.checked = true;
    } else {
        elements.normalMode.checked = true;
    }
    
    // Update form visibility
    updateFormVisibility();
    
    // Populate form with preset data
    populateFormFromConfig(preset, presetMode);
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
// BREATHING PRESETS SYSTEM
// ============================================================================

/**
 * Gets all built-in breathing presets, optionally filtered by category
 * @param {string} category - Optional category filter
 * @returns {Array} Array of preset objects
 */
function getBuiltInBreathingPresets(category = '') {
    if (!category) {
        // Return all presets from all categories
        return Object.values(BUILT_IN_BREATHING_PRESETS).flat();
    }
    return BUILT_IN_BREATHING_PRESETS[category] || [];
}

/**
 * Loads user's custom breathing presets from localStorage
 * @returns {Object} Object with preset names as keys and configs as values
 */
function loadBreathingPresetsFromStorage() {
    try {
        const stored = localStorage.getItem(BREATHING_PRESETS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error loading breathing presets:', e);
        return {};
    }
}

/**
 * Saves a breathing preset to localStorage
 */
function saveBreathingPreset() {
    loadBreathingConfigFromForm();
    
    const presetName = elements.breathingPresetName.value.trim();
    if (!presetName) {
        alert('Please enter a preset name to save');
        if (elements.breathingPresetName) elements.breathingPresetName.focus();
        return;
    }
    
    // Check if it's a built-in preset name
    const allBuiltIn = getBuiltInBreathingPresets();
    if (allBuiltIn.some(p => p.name === presetName)) {
        alert('This name is reserved for a built-in preset. Please choose a different name.');
        if (elements.breathingPresetName) elements.breathingPresetName.focus();
        return;
    }
    
    try {
        const presets = loadBreathingPresetsFromStorage();
        presets[presetName] = {
            ...workoutState.breathingConfig,
            name: presetName,
            isCustom: true
        };
        localStorage.setItem(BREATHING_PRESETS_STORAGE_KEY, JSON.stringify(presets));
        
        loadBreathingPresets();
        elements.breathingPresetName.value = '';
        alert(`Preset "${presetName}" saved!`);
    } catch (e) {
        console.error('Error saving breathing preset:', e);
        alert('Error saving preset. localStorage may not be available.');
    }
}

/**
 * Loads and displays all saved breathing presets in the UI
 */
function loadBreathingPresets() {
    const presets = loadBreathingPresetsFromStorage();
    const presetNames = Object.keys(presets);
    
    if (presetNames.length === 0) {
        elements.breathingPresetsList.innerHTML = '<p class="no-presets">No custom presets saved yet. Configure a breathing pattern and click "Save" to create one.</p>';
        return;
    }
    
    elements.breathingPresetsList.innerHTML = presetNames.map(name => {
        const preset = presets[name];
        return `
            <div class="preset-item">
                <span class="preset-name" onclick="loadBreathingPreset('${name.replace(/'/g, "\\'")}')">${escapeHtml(name)}</span>
                <div class="preset-actions">
                    <button class="btn btn-secondary btn-small" onclick="loadBreathingPreset('${name.replace(/'/g, "\\'")}')">Load</button>
                    <button class="btn btn-danger btn-small" onclick="deleteBreathingPreset('${name.replace(/'/g, "\\'")}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Loads a breathing preset into the form
 * @param {string} name - Preset name (for custom presets) or preset object (for built-in)
 */
function loadBreathingPreset(name) {
    let preset;
    
    // Check if it's a built-in preset (passed as object) or custom preset (passed as string)
    if (typeof name === 'object') {
        preset = name;
    } else {
        // Custom preset
        const presets = loadBreathingPresetsFromStorage();
        if (!presets[name]) {
            alert('Preset not found');
            return;
        }
        preset = presets[name];
    }
    
    if (workoutState.breathingIsRunning) {
        if (!confirm('A breathing session is in progress. Loading a preset will reset the timer. Continue?')) {
            return;
        }
        resetBreathingTimer();
    }
    
    // Populate form with preset data
    populateBreathingFormFromPreset(preset);
    loadBreathingConfigFromForm();
    
    // Clear preset selection dropdowns
    if (elements.breathingCategory) elements.breathingCategory.value = '';
    if (elements.breathingPreset) elements.breathingPreset.value = '';
    if (elements.breathingPresetInfo) elements.breathingPresetInfo.style.display = 'none';
}

/**
 * Populates breathing form fields from preset data
 * @param {Object} preset - Preset object with breathIn, inhaledHold, breathOut, exhaledHold
 */
function populateBreathingFormFromPreset(preset) {
    if (elements.breathInTime) elements.breathInTime.value = preset.breathIn || 4;
    if (elements.inhaledHoldTime) elements.inhaledHoldTime.value = preset.inhaledHold || 0;
    if (elements.breathOutTime) elements.breathOutTime.value = preset.breathOut || 4;
    if (elements.exhaledHoldTime) elements.exhaledHoldTime.value = preset.exhaledHold || 0;
}

/**
 * Deletes a breathing preset from localStorage
 * @param {string} name - Preset name
 */
function deleteBreathingPreset(name) {
    if (!confirm(`Delete preset "${name}"?`)) {
        return;
    }
    
    try {
        const presets = loadBreathingPresetsFromStorage();
        delete presets[name];
        localStorage.setItem(BREATHING_PRESETS_STORAGE_KEY, JSON.stringify(presets));
        loadBreathingPresets();
    } catch (e) {
        console.error('Error deleting breathing preset:', e);
        alert('Error deleting preset.');
    }
}

/**
 * Populates the preset dropdown based on selected category
 */
function updateBreathingPresetDropdown() {
    const category = elements.breathingCategory.value;
    const presetSelect = elements.breathingPreset;
    
    if (!presetSelect) return;
    
    // Clear existing options except the first one
    presetSelect.innerHTML = '<option value="">Choose a preset...</option>';
    
    // Get presets for selected category
    const presets = getBuiltInBreathingPresets(category);
    
    // Add built-in presets
    presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = JSON.stringify(preset); // Store preset as JSON string
        option.textContent = preset.name;
        presetSelect.appendChild(option);
    });
    
    // Add custom presets if no category filter or category matches
    if (!category) {
        const customPresets = loadBreathingPresetsFromStorage();
        Object.keys(customPresets).forEach(name => {
            const option = document.createElement('option');
            option.value = name; // Custom presets use name as value
            option.textContent = `${name} (Custom)`;
            presetSelect.appendChild(option);
        });
    }
}

/**
 * Displays preset information when a preset is selected
 */
function displayBreathingPresetInfo(preset) {
    if (!preset || !elements.breathingPresetInfo) return;
    
    if (preset.description || preset.useCase) {
        if (elements.breathingPresetDescription) {
            elements.breathingPresetDescription.textContent = preset.description || '';
        }
        if (elements.breathingPresetUseCase) {
            elements.breathingPresetUseCase.textContent = preset.useCase ? `Use: ${preset.useCase}` : '';
        }
        elements.breathingPresetInfo.style.display = 'block';
    } else {
        elements.breathingPresetInfo.style.display = 'none';
    }
}

// Make functions available globally for onclick handlers
window.loadBreathingPreset = loadBreathingPreset;
window.deleteBreathingPreset = deleteBreathingPreset;

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
            lastConfig: workoutState.config,
            lastMode: workoutState.workoutMode
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
        
        // Restore last config if available (only if mode matches)
        if (settings.lastConfig && settings.lastMode === workoutState.workoutMode) {
            populateFormFromConfig(settings.lastConfig, workoutState.workoutMode);
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
 * Updates form visibility based on selected mode
 */
function updateFormVisibility() {
    if (workoutState.workoutMode === 'headToHead') {
        elements.normalFormSection.style.display = 'none';
        elements.headToHeadFormSection.style.display = 'block';
    } else if (workoutState.workoutMode === 'stopwatch') {
        elements.normalFormSection.style.display = 'none';
        elements.headToHeadFormSection.style.display = 'none';
    } else {
        elements.normalFormSection.style.display = 'block';
        elements.headToHeadFormSection.style.display = 'none';
    }
    
    // Show/hide lap times list based on mode
    if (workoutState.workoutMode === 'stopwatch') {
        elements.lapTimesList.style.display = 'block';
    } else {
        elements.lapTimesList.style.display = 'none';
    }
    
    // Hide lap button when not in stopwatch mode or not running
    if (workoutState.workoutMode !== 'stopwatch' || !workoutState.isRunning) {
        elements.lapBtn.style.display = 'none';
    }
}

/**
 * Switches between workout and breathing tabs
 * @param {string} tab - 'workout' or 'breathing'
 */
function switchTab(tab) {
    if (tab === 'breathing') {
        // Check if workout timer is running
        if (workoutState.isRunning) {
            if (!confirm('Switching to breathing will stop the workout timer. Continue?')) {
                // Restore workout tab
                if (elements.workoutTab) elements.workoutTab.checked = true;
                return;
            }
            resetTimer();
        }
        
        workoutState.breathingMode = true;
        if (elements.workoutContent) elements.workoutContent.style.display = 'none';
        if (elements.breathingContent) elements.breathingContent.style.display = 'block';
    } else {
        // Check if breathing timer is running
        if (workoutState.breathingIsRunning) {
            if (!confirm('Switching to workout timer will stop the breathing timer. Continue?')) {
                // Restore breathing tab
                if (elements.breathingTab) elements.breathingTab.checked = true;
                return;
            }
            resetBreathingTimer();
        }
        
        workoutState.breathingMode = false;
        if (elements.workoutContent) elements.workoutContent.style.display = 'block';
        if (elements.breathingContent) elements.breathingContent.style.display = 'none';
    }
}

/**
 * Initializes all event listeners
 */
function initEventListeners() {
    // Mode toggle handlers
    elements.normalMode.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (workoutState.isRunning) {
                if (!confirm('Switching modes will reset the timer. Continue?')) {
                    e.target.checked = false;
                    // Restore previous mode
                    if (workoutState.workoutMode === 'headToHead') {
                        elements.headToHeadMode.checked = true;
                    } else if (workoutState.workoutMode === 'stopwatch') {
                        elements.stopwatchMode.checked = true;
                    }
                    return;
                }
                resetTimer();
            }
            workoutState.workoutMode = 'normal';
            updateFormVisibility();
            updateDisplay();
        }
    });
    
    elements.headToHeadMode.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (workoutState.isRunning) {
                if (!confirm('Switching modes will reset the timer. Continue?')) {
                    e.target.checked = false;
                    // Restore previous mode
                    if (workoutState.workoutMode === 'normal') {
                        elements.normalMode.checked = true;
                    } else if (workoutState.workoutMode === 'stopwatch') {
                        elements.stopwatchMode.checked = true;
                    }
                    return;
                }
                resetTimer();
            }
            workoutState.workoutMode = 'headToHead';
            updateFormVisibility();
            updateDisplay();
        }
    });
    
    elements.stopwatchMode.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (workoutState.isRunning) {
                if (!confirm('Switching modes will reset the timer. Continue?')) {
                    e.target.checked = false;
                    // Restore previous mode
                    if (workoutState.workoutMode === 'normal') {
                        elements.normalMode.checked = true;
                    } else if (workoutState.workoutMode === 'headToHead') {
                        elements.headToHeadMode.checked = true;
                    }
                    return;
                }
                resetTimer();
            }
            workoutState.workoutMode = 'stopwatch';
            updateFormVisibility();
            updateDisplay();
        }
    });
    
    // Tab navigation handlers
    if (elements.workoutTab) {
        elements.workoutTab.addEventListener('change', (e) => {
            if (e.target.checked) {
                switchTab('workout');
            }
        });
    }
    
    if (elements.breathingTab) {
        elements.breathingTab.addEventListener('change', (e) => {
            if (e.target.checked) {
                switchTab('breathing');
            }
        });
    }
    
    // Control buttons
    elements.startBtn.addEventListener('click', async () => {
        await initAudioContext();
        // Small delay to ensure audio is unlocked before starting timer (iOS requirement)
        setTimeout(() => {
            startTimer();
        }, 50);
    });
    
    elements.pauseBtn.addEventListener('click', () => {
        if (workoutState.isPaused) {
            resumeTimer();
        } else {
            pauseTimer();
        }
    });
    
    elements.lapBtn.addEventListener('click', () => {
        recordLap();
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
    
    // Breathing control buttons
    if (elements.breathingStartBtn) {
        elements.breathingStartBtn.addEventListener('click', async () => {
            await initAudioContext();
            // Small delay to ensure audio is unlocked before starting timer (iOS requirement)
            setTimeout(() => {
                startBreathingTimer();
            }, 50);
        });
    }
    
    if (elements.breathingPauseBtn) {
        elements.breathingPauseBtn.addEventListener('click', () => {
            if (workoutState.breathingIsPaused) {
                resumeBreathingTimer();
            } else {
                pauseBreathingTimer();
            }
        });
    }
    
    if (elements.breathingResetBtn) {
        elements.breathingResetBtn.addEventListener('click', () => {
            if (workoutState.breathingIsRunning) {
                if (confirm('Reset the breathing timer? Current progress will be lost.')) {
                    resetBreathingTimer();
                }
            } else {
                resetBreathingTimer();
            }
        });
    }
    
    // Breathing preset handlers
    if (elements.breathingCategory) {
        elements.breathingCategory.addEventListener('change', () => {
            updateBreathingPresetDropdown();
            // Clear preset selection when category changes
            if (elements.breathingPreset) elements.breathingPreset.value = '';
            if (elements.breathingPresetInfo) elements.breathingPresetInfo.style.display = 'none';
        });
    }
    
    if (elements.breathingPreset) {
        elements.breathingPreset.addEventListener('change', (e) => {
            const value = e.target.value;
            if (!value) {
                if (elements.breathingPresetInfo) elements.breathingPresetInfo.style.display = 'none';
                return;
            }
            
            // Try to parse as JSON (built-in preset) or use as string (custom preset)
            let preset;
            try {
                preset = JSON.parse(value);
                // Built-in preset
                displayBreathingPresetInfo(preset);
                loadBreathingPreset(preset);
            } catch (e) {
                // Custom preset - value is the name
                const customPresets = loadBreathingPresetsFromStorage();
                preset = customPresets[value];
                if (preset) {
                    displayBreathingPresetInfo(preset);
                    loadBreathingPreset(value);
                }
            }
        });
    }
    
    if (elements.saveBreathingPresetBtn) {
        elements.saveBreathingPresetBtn.addEventListener('click', saveBreathingPreset);
    }
    
    // Allow Enter key to save preset
    if (elements.breathingPresetName) {
        elements.breathingPresetName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveBreathingPreset();
            }
        });
    }
    
    // Settings toggles
    elements.enableSounds.addEventListener('change', async (e) => {
        workoutState.soundsEnabled = e.target.checked;
        if (e.target.checked) {
            await initAudioContext();
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
    
    // Save preset buttons
    elements.savePresetBtn.addEventListener('click', savePreset);
    elements.savePresetHeadToHeadBtn.addEventListener('click', savePreset);
    
    // Save config on form changes (for last-used settings)
    const formInputs = [
        elements.workoutName,
        elements.setupDuration,
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
    
    // Initialize audio context on any user interaction (critical for iOS)
    const initAudioOnInteraction = async () => {
        await initAudioContext();
    };
    
    document.addEventListener('click', initAudioOnInteraction, { once: true });
    document.addEventListener('touchstart', initAudioOnInteraction, { once: true });
    document.addEventListener('touchend', initAudioOnInteraction, { once: true });
    
    // Handle page visibility changes to reacquire wake lock if needed
    document.addEventListener('visibilitychange', handleVisibilityChange);
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
    loadBreathingPresets();
    
    // Initialize form visibility based on current mode
    updateFormVisibility();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initialize breathing preset dropdown
    updateBreathingPresetDropdown();
    
    // Initialize display
    updateDisplay();
    
    // Initialize breathing display
    updateBreathingDisplay();
    
    // Force initialize breathing circle positioning - CRITICAL FIX
    setTimeout(() => {
        const circle = document.getElementById('breathingCircle');
        const section = document.querySelector('#breathingContent .breathing-section');
        const container = document.querySelector('.breathing-graphic-container');
        
        if (circle) {
            circle.style.cssText = 'position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; margin: 0 !important; width: 130px !important; height: 130px !important; background-color: #C8A8E9 !important; border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 10 !important;';
            console.log('Breathing circle initialized');
        } else {
            console.error('Breathing circle element not found!');
        }
        
        if (section) {
            section.style.cssText += 'overflow: hidden !important; position: relative !important; min-height: 500px !important; justify-content: flex-start !important;';
        }
        
        if (container) {
            container.style.cssText += 'position: relative !important; flex-shrink: 0 !important; min-height: 300px !important;';
        }
    }, 100);
    
    // Initialize audio context if already interacted
    initAudioContext().catch(err => {
        console.warn('Could not initialize audio context:', err);
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

