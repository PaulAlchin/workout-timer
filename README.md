# Workout Timer Web App

A mobile-friendly, static workout timer web app with multiple timer modes, configurable intervals, preset saving, sound/vibration cues, and PWA support for offline use.

## Features

### Three Timer Modes

#### 1. Normal Timer Mode
- **Configurable Timer Settings**
  - Setup timer (countdown before workout starts)
  - Warm-up duration
  - Work duration
  - Rest duration between sets
  - Long rest between rounds
  - Number of sets per round
  - Number of rounds
  - Custom workout names

- **Visual Phase Indicators**
  - Color-coded phases:
    - Setup: Blue-gray
    - Warm-up: Amber/Orange
    - Work: Green
    - Rest: Blue
    - Long Rest: Purple
  - Large, easy-to-read timer display with centisecond precision (MM:SS.mm)
  - Progress bar showing overall workout completion
  - Round and set counters

#### 2. Head-to-Head Rotation Mode
- **Rotation Timer**
  - Multiple people rotate through work intervals
  - Configurable number of people (1-10)
  - Work duration per person
  - Number of rounds
  - Setup timer before first round
  - Custom workout names

- **Person-Specific Colors**
  - Each person gets a unique background color during their work phase
  - 10 distinct colors that cycle (person 11 uses person 1's color, etc.)
  - Color palette: Green, Blue, Orange, Purple, Red, Teal, Pink, Amber, Indigo, Cyan

- **Visual Indicators**
  - Current person display
  - Round and person counters
  - Centisecond precision timer display

#### 3. Stopwatch Mode
- **Full-Featured Stopwatch**
  - Start/Pause/Resume functionality
  - Reset to clear elapsed time and laps
  - Lap time recording
  - Elapsed time display with centisecond precision (MM:SS.mm)

- **Lap Times**
  - Record multiple lap times
  - Display shows lap number, total elapsed time, and individual lap duration
  - Scrollable lap times list
  - All times shown with centisecond precision

### Timer Precision
- **High Accuracy**
  - Updates every 10ms (100 times per second)
  - Centisecond precision (0.01 seconds)
  - Display format: MM:SS.mm (minutes:seconds.centiseconds)

### Sound & Vibration
- **Audio Cues**
  - Optional beeps at interval transitions
  - Different beep frequencies for different events:
    - Start: 800Hz
    - End/Transition: 400Hz
    - Round Start: 600Hz (double beep)
    - Complete: 500Hz
  - Lap recording beep
  - Can be enabled/disabled

- **Vibration Cues**
  - Vibration patterns on supported devices
  - Different patterns for different events
  - Can be enabled/disabled

### Presets System
- **Save and Load Workouts**
  - Save custom workout configurations as presets
  - Presets are mode-specific (Normal, Head-to-Head, or Stopwatch)
  - Persistent storage using localStorage
  - Easy preset management (load/delete)
  - Presets include all configuration settings

### User Interface
- **Dark Mode**
  - Toggle between light and dark themes
  - Theme preference is saved automatically
  - Smooth transitions between themes

- **Responsive Design**
  - Mobile-friendly interface
  - Touch-optimized buttons
  - Works on all screen sizes
  - Accessible keyboard navigation

### PWA Support
- **Progressive Web App**
  - Add to home screen on mobile devices
  - Offline functionality after first load
  - Standalone app experience
  - Service worker for caching
  - App icons (192x192 and 512x512)

### Screen Wake Lock
- **Prevent Screen Sleep**
  - Automatically keeps screen awake during workouts
  - Works in standalone/PWA mode
  - Helps maintain visibility during exercises

## Installation

1. Clone this repository or download the files
2. No build process required - just open `index.html` in a browser
3. For best experience, add to home screen on mobile devices

## Usage

### Normal Timer Mode
1. Select "Normal Timer" mode
2. Configure your workout settings:
   - Enter a workout name (optional)
   - Set setup timer duration (optional, default: 10 seconds)
   - Set warm-up duration (optional)
   - Set work duration (required)
   - Set rest duration between sets (optional)
   - Set long rest duration between rounds (optional)
   - Set number of sets per round (required)
   - Set number of rounds (required)
3. Click "Start" to begin the timer
4. Use "Pause/Resume" to control the workout
5. Click "Reset" to stop and reset the timer
6. Save frequently used configurations as presets

### Head-to-Head Rotation Mode
1. Select "Head-to-Head Rotation" mode
2. Configure your rotation settings:
   - Enter a workout name (optional)
   - Set number of people (1-10)
   - Set work duration per person (required)
   - Set number of rounds (required)
   - Set setup timer duration (optional, default: 10 seconds)
3. Click "Start" to begin
4. Each person will have a unique color during their work phase
5. Timer automatically rotates through all people for each round

### Stopwatch Mode
1. Select "Stopwatch" mode
2. Click "Start" to begin timing
3. Click "Lap" to record lap times while running
4. Click "Pause" to pause, then "Resume" to continue
5. Click "Reset" to clear elapsed time and all lap times

### General Features
- Enable/disable sounds and vibration in Settings
- Toggle dark mode using the switch in the header
- Save workout configurations as presets for quick access
- Load saved presets to quickly configure workouts

## Hosting on GitHub Pages

This app is ready to be hosted on GitHub Pages:

1. Push this repository to GitHub
2. Go to repository Settings → Pages
3. Select the branch (usually `main` or `master`)
4. Select the root folder
5. Your app will be available at `https://yourusername.github.io/repository-name/`

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled
- Screen Wake Lock API supported on most modern browsers (with PWA installation on iOS)

## Technical Details

- **Pure JavaScript**: No frameworks or dependencies
- **LocalStorage**: Presets and settings are saved locally
- **Service Worker**: Enables offline functionality and PWA features
- **Web Audio API**: For sound generation
- **Vibration API**: For haptic feedback
- **Screen Wake Lock API**: To prevent screen from sleeping

## License

Free to use and modify.
