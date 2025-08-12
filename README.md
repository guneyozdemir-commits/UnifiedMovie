# 🎬 Unified Movie Score

A modern web application that aggregates movie ratings from multiple sources (Rotten Tomatoes, Metacritic, and IMDb) and calculates a unified score on a 0-100 scale.

## ✨ Features

- **Multi-Source Aggregation**: Combines ratings from three major movie rating platforms
- **Unified Scoring**: Converts all scores to a consistent 0-100 scale
- **Modern UI**: Beautiful, responsive design identical to duneawakening.com
- **Real-time Search**: Instant movie search with loading states
- **Score Breakdown**: Detailed view of individual scores and calculations
- **Mobile Responsive**: Works perfectly on all device sizes

## 🚀 How to Use

1. **Open the App**: Simply open `index.html` in your web browser
2. **Search for a Movie**: Enter any movie title in the search box
3. **View Results**: See the unified score and individual platform scores
4. **Understand the Breakdown**: Check how the unified score was calculated

## 📊 Score Calculation

The unified score is calculated by:
- **Rotten Tomatoes**: Critic score (0-100 scale)
- **Metacritic**: Metascore (0-100 scale)  
- **IMDb**: User rating converted from 0-10 to 0-100 scale

The final score is the average of all available scores, ensuring a comprehensive rating.

## 🛠️ Technical Details

- **Frontend**: Pure HTML, CSS, and JavaScript (no frameworks)
- **Design**: Dark cinematic theme identical to duneawakening.com with glass morphism
- **Responsiveness**: Mobile-first approach with CSS media queries
- **Icons**: Font Awesome for beautiful icons
- **Fonts**: Dune Rise throughout entire interface (authentic Denis Villeneuve Dune aesthetic)

## 🚀 Current Status

This app now includes a **Node.js + Puppeteer web scraper** that fetches real movie scores from:
- **Rotten Tomatoes**: Critic scores (0-100 scale) - Using Puppeteer for dynamic content
- **Metacritic**: Metascore (0-100 scale) - ✅ **Working!** Successfully scraping scores like 74 for "Inception" and 85 for "The Dark Knight"
- **IMDb**: User ratings (0-10 scale, converted to 0-100) - ✅ **Working!** Successfully scraping ratings like 8.8 for "Inception"

The scraper runs on a Node.js backend server and provides a REST API endpoint. Puppeteer is used for sites that load scores dynamically with JavaScript.

## 🔮 Future Enhancements

In a production environment, you could:
- Add user accounts and favorite movies
- Implement movie recommendations
- Add historical score tracking
- Include more rating sources
- Add caching to reduce API calls

## 📱 Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## 🎯 Demo Movies to Try

- "The Shawshank Redemption"
- "Inception"
- "Pulp Fiction"
- "The Dark Knight"
- "Fight Club"

## 📁 File Structure

```
unified-movie-score/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## 🚀 Quick Start

1. Download or clone the project files
2. Open `index.html` in your web browser
3. Start searching for movies!

## 📄 License

This project is open source and available under the MIT License.

---

**Note**: This demo version uses simulated data to demonstrate the concept. For real movie data, you would need to integrate with actual movie API services.
