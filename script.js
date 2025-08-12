// Unified Movie Score Web App
class MovieScoreApp {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.hideAllSections();
    }

    initializeElements() {
        this.movieInput = document.getElementById('movieInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.resultsSection = document.getElementById('resultsSection');
        this.errorSection = document.getElementById('errorSection');
        
        // Results elements
        this.movieTitle = document.getElementById('movieTitle');
        this.unifiedScore = document.getElementById('unifiedScore');
        this.rtScore = document.getElementById('rtScore');
        this.metacriticScore = document.getElementById('metacriticScore');
        this.imdbScore = document.getElementById('imdbScore');
        
        // Breakdown elements
        this.rtBreakdown = document.getElementById('rtBreakdown');
        this.metacriticBreakdown = document.getElementById('metacriticBreakdown');
        this.imdbBreakdown = document.getElementById('imdbBreakdown');
        this.totalBreakdown = document.getElementById('totalBreakdown');
    }

    bindEvents() {
        this.searchBtn.addEventListener('click', () => this.searchMovie());
        this.movieInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchMovie();
            }
        });

        // Add click handlers for top movies
        document.querySelectorAll('.top-movie').forEach(movie => {
            movie.addEventListener('click', (e) => {
                const movieTitle = e.currentTarget.dataset.movie;
                this.movieInput.value = movieTitle;
                this.searchMovie();
                
                // Scroll to results
                this.resultsSection.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    hideAllSections() {
        this.loadingSpinner.classList.add('hidden');
        this.resultsSection.classList.add('hidden');
        this.errorSection.classList.add('hidden');
    }

    async searchMovie() {
        const movieTitle = this.movieInput.value.trim();
        
        if (!movieTitle) {
            this.showError('Please enter a movie title');
            return;
        }

        this.hideAllSections();
        this.loadingSpinner.classList.remove('hidden');
        this.searchBtn.disabled = true;

        try {
            const scores = await this.getMovieScores(movieTitle);
            this.displayResults(movieTitle, scores);
        } catch (error) {
            console.error('Error searching for movie:', error);
            this.showError(error.message || 'Failed to fetch movie scores');
        } finally {
            this.loadingSpinner.classList.add('hidden');
            this.searchBtn.disabled = false;
        }
    }

    async getMovieScores(movieTitle) {
        try {
            // Make API call to our Node.js backend
            const response = await fetch(`/api/movie/${encodeURIComponent(movieTitle)}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch movie scores');
            }
            
            const data = await response.json();
            return data.scores;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    displayResults(movieTitle, scores) {
        this.movieTitle.textContent = movieTitle;
        
        // Display individual scores
        this.rtScore.textContent = scores.rottenTomatoes !== null ? scores.rottenTomatoes : 'N/A';
        this.metacriticScore.textContent = scores.metacritic !== null ? scores.metacritic : 'N/A';
        this.imdbScore.textContent = scores.imdb !== null ? scores.imdb : 'N/A';
        
        // Calculate unified score
        const unifiedScore = this.calculateUnifiedScore(scores);
        this.unifiedScore.textContent = Math.round(unifiedScore);
        
        // Display breakdown
        this.displayBreakdown(scores, unifiedScore);
        
        // Show results
        this.resultsSection.classList.remove('hidden');
    }

    calculateUnifiedScore(scores) {
        let totalScore = 0;
        let validScores = 0;
        
        // Rotten Tomatoes (0-100 scale)
        if (scores.rottenTomatoes !== null) {
            totalScore += scores.rottenTomatoes;
            validScores++;
        }
        
        // Metacritic (0-100 scale)
        if (scores.metacritic !== null) {
            totalScore += scores.metacritic;
            validScores++;
        }
        
        // IMDb (0-10 scale, convert to 0-100)
        if (scores.imdb !== null) {
            totalScore += scores.imdb * 10;
            validScores++;
        }
        
        return validScores > 0 ? totalScore / validScores : 0;
    }

    displayBreakdown(scores, unifiedScore) {
        // Rotten Tomatoes breakdown
        if (scores.rottenTomatoes !== null) {
            this.rtBreakdown.textContent = `${scores.rottenTomatoes}/100`;
        } else {
            this.rtBreakdown.textContent = 'Not available';
        }
        
        // Metacritic breakdown
        if (scores.metacritic !== null) {
            this.metacriticBreakdown.textContent = `${scores.metacritic}/100`;
        } else {
            this.metacriticBreakdown.textContent = 'Not available';
        }
        
        // IMDb breakdown
        if (scores.imdb !== null) {
            this.imdbBreakdown.textContent = `${scores.imdb}/10 (${(scores.imdb * 10).toFixed(0)}/100)`;
        } else {
            this.imdbBreakdown.textContent = 'Not available';
        }
        
        // Total breakdown
        this.totalBreakdown.textContent = `${Math.round(unifiedScore)}/100`;
    }

    showError(message) {
        this.errorSection.classList.remove('hidden');
        document.getElementById('errorMessage').textContent = message;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MovieScoreApp();
});

// Add some helpful console messages
console.log('🎬 Unified Movie Score App loaded with real web scraping!');
console.log('💡 Try searching for movies like: "The Shawshank Redemption", "Inception", "Pulp Fiction"');
console.log('🔍 Now fetching real scores from Rotten Tomatoes, Metacritic, and IMDb!');
