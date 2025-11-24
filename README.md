# Workout Timer Web App

A mobile-friendly, static workout timer web app with configurable intervals, preset saving, sound/vibration cues, and PWA support for offline use.

## Features

- **Configurable Timer Settings**
  - Warm-up duration
  - Work duration
  - Rest duration between sets
  - Long rest between rounds
  - Number of sets per round
  - Number of rounds
  - Custom workout names

- **Visual Phase Indicators**
  - Color-coded phases (Warm-up: amber, Work: green, Rest: blue, Long Rest: purple)
  - Large, easy-to-read timer display
  - Progress bar showing overall workout completion
  - Round and set counters

- **Sound & Vibration**
  - Optional beeps at interval transitions
  - Special double-beep for round starts
  - Vibration cues (on supported devices)

- **Presets System**
  - Save and load custom workout configurations
  - Persistent storage using localStorage
  - Easy preset management (load/delete)

- **Dark Mode**
  - Toggle between light and dark themes
  - Theme preference is saved

- **PWA Support**
  - Add to home screen on mobile devices
  - Offline functionality after first load
  - Standalone app experience

## Installation

1. Clone this repository or download the files
2. No build process required - just open `index.html` in a browser

## Usage

1. Configure your workout settings in the form
2. Click "Start" to begin the timer
3. Use "Pause/Resume" to control the workout
4. Save frequently used configurations as presets
5. Enable/disable sounds and vibration as needed

## Hosting on GitHub Pages

This app is ready to be hosted on GitHub Pages:

1. Push this repository to GitHub
2. Go to repository Settings → Pages
3. Select the branch (usually `main` or `master`)
4. Your app will be available at `https://yourusername.github.io/repository-name/`

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled

## License

Free to use and modify.

