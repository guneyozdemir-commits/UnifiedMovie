# 🎬 Unified Movie Score - Setup Guide

## 🚀 Quick Start

### Option 1: Using the startup script (Recommended)
```bash
./start.sh
```

### Option 2: Manual setup
```bash
# Install dependencies
npm install

# Start the server
npm start
```

## 🌐 Access the App

- **Web Interface**: http://localhost:3000
- **API Endpoint**: http://localhost:3000/api/movie/:title
- **Health Check**: http://localhost:3000/api/health

## 🔍 How It Works

1. **Frontend**: Beautiful HTML/CSS/JS interface for searching movies
2. **Backend**: Node.js + Express server with Cheerio web scraping
3. **Data Sources**: 
   - Rotten Tomatoes (critic scores)
   - Metacritic (metascore)
   - IMDb (user ratings)
4. **Unified Score**: Average of all available scores on a 0-100 scale

## 📊 Current Status

✅ **Working**: 
- IMDb scraping (successfully getting ratings like 9.3 for "The Shawshank Redemption")
- Node.js backend server
- REST API endpoints
- Frontend interface
- Score calculation and display

🔄 **In Progress**:
- Rotten Tomatoes scraping (selectors need refinement)
- Metacritic scraping (selectors need refinement)

## 🛠️ Technical Details

- **Backend**: Node.js + Express + Cheerio
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Scraping**: Uses Cheerio for HTML parsing
- **User Agents**: Rotates between different user agents to avoid blocking
- **Error Handling**: Comprehensive error handling with retry logic
- **CORS**: Enabled for cross-origin requests

## 🔧 Troubleshooting

### Server won't start
- Check if port 3000 is available
- Ensure Node.js is installed (`node --version`)
- Check for missing dependencies (`npm install`)

### No scores returned
- Some websites may block automated requests
- Try different movie titles
- Check browser console for errors

### Scraping issues
- Websites may have changed their HTML structure
- Selectors may need updating
- Rate limiting may be in effect

## 📝 API Usage

### Search for a movie
```bash
curl "http://localhost:3000/api/movie/Inception"
```

### Response format
```json
{
  "movieTitle": "Inception",
  "scores": {
    "rottenTomatoes": null,
    "metacritic": null,
    "imdb": 8.8
  },
  "unifiedScore": 88,
  "validScores": 1,
  "timestamp": "2025-08-12T07:19:11.697Z"
}
```

## 🎯 Next Steps

1. **Refine selectors** for Rotten Tomatoes and Metacritic
2. **Add caching** to reduce repeated scraping
3. **Implement rate limiting** to be respectful to websites
4. **Add more data sources** (e.g., Letterboxd, Google Reviews)
5. **Create a database** to store historical data

## ⚠️ Important Notes

- **Respectful scraping**: The app includes delays and user agent rotation
- **Legal compliance**: Ensure compliance with websites' terms of service
- **Rate limiting**: Consider implementing additional rate limiting
- **Error handling**: The app gracefully handles scraping failures

---

**Happy movie scoring! 🎬✨**
