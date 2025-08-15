class MovieScoreApp {
    constructor() {
        this.predictionMovies = [
            { title: "The Shawshank Redemption", score: 96 },
            { title: "The Godfather", score: 96 },
            { title: "The Dark Knight", score: 94 },
            { title: "The Godfather Part II", score: 95 },
            { title: "12 Angry Men", score: 96 },
            { title: "Schindler's List", score: 94 },
            { title: "The Lord of the Rings: The Return of the King", score: 93 },
            { title: "Pulp Fiction", score: 92 },
            { title: "The Lord of the Rings: The Fellowship of the Ring", score: 93 },
            { title: "The Good, the Bad and the Ugly", score: 93 },
            { title: "Forrest Gump", score: 91 },
            { title: "Fight Club", score: 91 },
            { title: "The Lord of the Rings: The Two Towers", score: 92 },
            { title: "Inception", score: 90 },
            { title: "Star Wars: Episode V - The Empire Strikes Back", score: 92 },
            { title: "The Matrix", score: 91 },
            { title: "Goodfellas", score: 92 },
            { title: "One Flew Over the Cuckoo's Nest", score: 93 },
            { title: "Seven Samurai", score: 95 },
            { title: "Se7en", score: 90 },
            { title: "City of God", score: 92 },
            { title: "Life Is Beautiful", score: 91 },
            { title: "The Silence of the Lambs", score: 91 },
            { title: "It's a Wonderful Life", score: 92 },
            { title: "Star Wars: Episode IV - A New Hope", score: 91 },
            { title: "Saving Private Ryan", score: 90 },
            { title: "Spirited Away", score: 93 },
            { title: "The Green Mile", score: 89 },
            { title: "Interstellar", score: 89 },
            { title: "Parasite", score: 94 },
            { title: "Léon: The Professional", score: 90 },
            { title: "The Usual Suspects", score: 91 },
            { title: "The Lion King", score: 90 },
            { title: "American History X", score: 89 },
            { title: "Back to the Future", score: 91 },
            { title: "The Pianist", score: 91 },
            { title: "Modern Times", score: 93 },
            { title: "Gladiator", score: 90 },
            { title: "The Departed", score: 89 },
            { title: "The Prestige", score: 90 }
        ];
        this.currentPredictionMovie = null;
        this.movieInput = document.getElementById('movieInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsSection = document.querySelector('.results-section');
        this.movieTitle = document.querySelector('.movie-title');
        this.rottenTomatoesScore = document.getElementById('rottenTomatoesScore');
        this.metacriticScore = document.getElementById('metacriticScore');
        this.imdbScore = document.getElementById('imdbScore');
        this.unifiedScore = document.getElementById('unifiedScore');
        this.loading = document.querySelector('.loading');
        this.errorMessage = document.querySelector('.error-message');
        this.suggestionsDropdown = document.getElementById('suggestions');
        this.darkModeToggle = document.getElementById('darkModeToggle');
        
        this.selectedSuggestionIndex = -1;
        this.suggestions = [];
        this.loadMovieTitles();
        this.initializeDarkMode();
        this.bindEvents();
        this.hideResults();
    }

    initializeDarkMode() {
        // Check for saved theme preference or system preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.body.dataset.theme = savedTheme;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.dataset.theme = 'dark';
        }
    }

    bindEvents() {
        // Prediction elements
        this.predictButton = document.getElementById('predictButton');
        this.predictionSection = document.getElementById('prediction');
        this.predictMovieTitle = document.getElementById('predictMovieTitle');
        this.predictScore = document.getElementById('predictScore');
        this.submitPrediction = document.getElementById('submitPrediction');
        this.predictionResult = document.getElementById('predictionResult');

        // Prediction events
        this.predictButton.addEventListener('click', () => {
            this.predictButton.classList.toggle('active');
            this.predictionSection.classList.toggle('visible');
            if (this.predictionSection.classList.contains('visible')) {
                this.startNewPrediction();
            }
        });

        this.submitPrediction.addEventListener('click', () => this.checkPrediction());
        this.predictScore.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkPrediction();
            }
        });

        // Dark mode toggle
        this.darkModeToggle.addEventListener('click', () => {
            const currentTheme = document.body.dataset.theme;
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.body.dataset.theme = newTheme;
            localStorage.setItem('theme', newTheme);
        });

        // Search input events
        this.movieInput.addEventListener('input', () => this.handleInput());
        this.movieInput.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.movieInput.contains(e.target) && !this.suggestionsDropdown.contains(e.target)) {
                this.hideSuggestions();
            }
        });

        // Search button click
        this.searchBtn.addEventListener('click', () => this.searchMovie());
        
        // Top movies click
        document.querySelectorAll('.top-movie').forEach(movie => {
            movie.addEventListener('click', (e) => {
                const movieTitle = e.currentTarget.dataset.movie;
                this.movieInput.value = movieTitle;
                this.searchMovie();
                this.resultsSection.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    startNewPrediction() {
        // Reset UI
        this.predictScore.value = '';
        this.predictionResult.className = 'predict-result';
        this.predictionResult.textContent = '';
        
        // Get random movie
        const randomIndex = Math.floor(Math.random() * this.predictionMovies.length);
        this.currentPredictionMovie = this.predictionMovies[randomIndex];
        this.predictMovieTitle.textContent = this.currentPredictionMovie.title;
        
        // Focus input
        this.predictScore.focus();
    }

    checkPrediction() {
        const guess = parseInt(this.predictScore.value);
        if (isNaN(guess) || guess < 0 || guess > 100) {
            this.predictionResult.textContent = 'Please enter a valid score (0-100)';
            this.predictionResult.className = 'predict-result visible incorrect';
            return;
        }

        const actualScore = this.currentPredictionMovie.score;
        const difference = Math.abs(guess - actualScore);
        
        this.predictionResult.classList.add('visible');
        
        if (difference === 0) {
            this.predictionResult.textContent = '🎯 Perfect! Exactly right!';
            this.predictionResult.className = 'predict-result visible correct';
        } else if (difference <= 5) {
            this.predictionResult.textContent = `👏 Close! The actual score was ${actualScore}`;
            this.predictionResult.className = 'predict-result visible close';
        } else {
            this.predictionResult.textContent = `The actual score was ${actualScore}. Try another!`;
            this.predictionResult.className = 'predict-result visible incorrect';
        }

        // Start new prediction after 2 seconds
        setTimeout(() => {
            if (this.predictionSection.classList.contains('visible')) {
                this.startNewPrediction();
            }
        }, 2000);
    }

    async loadMovieTitles() {
        try {
            const response = await fetch('/movies.js');
            const text = await response.text();
            // Extract the array from the JavaScript file
            const match = text.match(/const\s+movieTitles\s*=\s*(\[[\s\S]*?\]);/);
            if (match) {
                this.movieTitles = JSON.parse(match[1]);
            } else {
                console.error('Could not parse movie titles');
                this.movieTitles = [];
            }
        } catch (error) {
            console.error('Error loading movie titles:', error);
            this.movieTitles = [];
        }
    }

    handleInput() {
        const input = this.movieInput.value.trim();
        if (input.length < 2) {
            this.hideSuggestions();
            return;
        }

        this.suggestions = this.movieTitles
            .filter(title => title.toLowerCase().includes(input.toLowerCase()))
            .slice(0, 5);

        if (this.suggestions.length > 0) {
            this.showSuggestions();
        } else {
            this.hideSuggestions();
        }
    }

    handleKeydown(e) {
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedSuggestionIndex = Math.min(
                    this.selectedSuggestionIndex + 1,
                    this.suggestions.length - 1
                );
                this.updateSelectedSuggestion();
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedSuggestionIndex = Math.max(
                    this.selectedSuggestionIndex - 1,
                    -1
                );
                this.updateSelectedSuggestion();
                break;

            case 'Enter':
                if (this.selectedSuggestionIndex >= 0) {
                    e.preventDefault();
                    this.selectSuggestion(this.suggestions[this.selectedSuggestionIndex]);
                }
                break;

            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    showSuggestions() {
        this.suggestionsDropdown.innerHTML = '';
        const input = this.movieInput.value.trim().toLowerCase();

        this.suggestions.forEach((title, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            if (index === this.selectedSuggestionIndex) {
                div.classList.add('selected');
            }

            // Highlight matching text
            const titleLower = title.toLowerCase();
            const startIndex = titleLower.indexOf(input);
            if (startIndex >= 0) {
                const beforeMatch = title.substring(0, startIndex);
                const match = title.substring(startIndex, startIndex + input.length);
                const afterMatch = title.substring(startIndex + input.length);
                div.innerHTML = beforeMatch + '<span class="highlight">' + match + '</span>' + afterMatch;
            } else {
                div.textContent = title;
            }

            div.addEventListener('click', () => this.selectSuggestion(title));
            div.addEventListener('mouseenter', () => {
                this.selectedSuggestionIndex = index;
                this.updateSelectedSuggestion();
            });

            this.suggestionsDropdown.appendChild(div);
        });

        this.suggestionsDropdown.classList.add('visible');
    }

    updateSelectedSuggestion() {
        const items = this.suggestionsDropdown.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === this.selectedSuggestionIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });

        if (this.selectedSuggestionIndex >= 0) {
            this.movieInput.value = this.suggestions[this.selectedSuggestionIndex];
        }
    }

    selectSuggestion(title) {
        this.movieInput.value = title;
        this.hideSuggestions();
        this.searchMovie();
    }

    hideSuggestions() {
        this.suggestionsDropdown.classList.remove('visible');
        this.selectedSuggestionIndex = -1;
    }

    showLoading() {
        this.loading.classList.add('visible');
        this.errorMessage.classList.remove('visible');
        this.hideResults();
    }

    hideLoading() {
        this.loading.classList.remove('visible');
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('visible');
        this.hideResults();
    }

    showResults() {
        this.resultsSection.style.display = 'block';
    }

    hideResults() {
        this.resultsSection.style.display = 'none';
    }

    async searchMovie() {
        const movieTitle = this.movieInput.value.trim();
        if (!movieTitle) {
            this.showError('Please enter a movie title');
            return;
        }

        this.showLoading();
        this.hideSuggestions();

        try {
            const response = await fetch(`/api/movie/${encodeURIComponent(movieTitle)}`);
            const data = await response.json();

            if (response.ok) {
                this.displayResults(data);
            } else {
                this.showError(data.error || 'Failed to fetch movie scores');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showError('Failed to connect to the server. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayResults(data) {
        this.movieTitle.textContent = data.movieTitle;
        
        this.rottenTomatoesScore.textContent = data.scores.rottenTomatoes ?? 'N/A';
        this.metacriticScore.textContent = data.scores.metacritic ?? 'N/A';
        this.imdbScore.textContent = data.scores.imdb ? Math.round(data.scores.imdb * 10) : 'N/A';
        this.unifiedScore.textContent = data.unifiedScore ?? 'N/A';

        this.showResults();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MovieScoreApp();
});