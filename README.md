# AnimeSwipe

This is for Jack. AnimeSwipe is a Tinder-style anime recommendation web application that helps you discover new anime based on your preferences. The app learns from your swipes to provide increasingly personalized recommendations over time.

## Features

- **Swipe Interface**: Swipe right to save anime you're interested in, swipe left to skip
- **Personalized Recommendations**: The app learns from your preferences to suggest anime you might like
- **Filtering Options**: Filter anime by genre, year, and minimum score
- **Saved Anime List**: View and manage your saved anime
- **Detailed Information**: View comprehensive details about each anime
- **Responsive Design**: Works on desktop and mobile devices
- **Local Storage**: Your preferences and saved anime are stored locally

## How to Use

1. **Browse Anime**: Swipe through anime cards to discover new shows
2. **Save Favorites**: Swipe right (heart button) to save anime you like
3. **Skip**: Swipe left (X button) to skip anime you're not interested in
4. **Filter**: Click the "Filters" button to set genre, year, and score preferences
5. **View Saved**: Click the "Saved Anime" button to see your saved list
6. **Details**: Click on any saved anime to view more details

## Technical Details

- Built with vanilla JavaScript, HTML, and CSS
- Uses the [Jikan API](https://jikan.moe/) (unofficial MyAnimeList API) for anime data
- Implements a recommendation system based on user preferences
- Stores user data in browser's localStorage

## Deployment

This application can be hosted on GitHub Pages as it's a client-side only application.

To deploy:
1. Push the code to a GitHub repository
2. Enable GitHub Pages in the repository settings
3. Set the source to the main branch

## Development

To run locally:
1. Clone the repository
2. Open the project folder
3. Start a local server (e.g., `python -m http.server`)
4. Open your browser to the local server address (typically `http://localhost:8000`)

## Future Enhancements

- Add user accounts for cross-device synchronization
- Implement more advanced recommendation algorithms
- Add social features to share recommendations
- Expand filtering options
- Add seasonal anime highlights
