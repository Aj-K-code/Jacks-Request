document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const animeTitle = document.getElementById('anime-title');
    const animeSynopsis = document.getElementById('anime-synopsis');
    const animeImage = document.getElementById('anime-image');
    const animeYear = document.getElementById('anime-year');
    const animeEpisodes = document.getElementById('anime-episodes');
    const animeScore = document.getElementById('anime-score');
    const animeGenres = document.getElementById('anime-genres');
    const swipeLeftButton = document.getElementById('swipe-left');
    const swipeRightButton = document.getElementById('swipe-right');
    const swipeUpButton = document.getElementById('swipe-up');
    const filterButton = document.getElementById('filter-button');
    const filterContent = document.getElementById('filter-content');
    const savedButton = document.getElementById('saved-button');
    const savedContent = document.getElementById('saved-content');
    const savedList = document.getElementById('saved-list');
    const seenButton = document.getElementById('seen-button');
    const seenContent = document.getElementById('seen-content');
    const seenList = document.getElementById('seen-list');
    const genreSelect = document.getElementById('genre-select');
    const yearMin = document.getElementById('year-min');
    const yearMax = document.getElementById('year-max');
    const scoreMin = document.getElementById('score-min');
    const scoreValue = document.getElementById('score-value');
    const applyFiltersButton = document.getElementById('apply-filters');
    const resetFiltersButton = document.getElementById('reset-filters');
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    const closeModal = document.querySelector('.close');

    // App State
    let currentAnime = null;
    let animeQueue = [];
    let savedAnimes = JSON.parse(localStorage.getItem('savedAnimes')) || [];
    let seenAnimes = JSON.parse(localStorage.getItem('seenAnimes')) || [];
    let userPreferences = JSON.parse(localStorage.getItem('userPreferences')) || {
        genres: {},
        studios: {},
        themes: {},
        ratings: {}
    };
    let allGenres = [];
    let filters = {
        genres: [],
        yearMin: null,
        yearMax: null,
        scoreMin: 0
    };
    
    // Constants
    const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
    const RATE_LIMIT_DELAY = 1000; // Jikan API has rate limits
    
    // Initialize the app
    const init = async () => {
        await loadGenres();
        updateSavedList();
        updateSeenList();
        loadAnimeQueue();
        setupEventListeners();
        setupTouchEvents();
    };
    
    // Load all available genres for filter
    const loadGenres = async () => {
        try {
            const response = await fetch(`${JIKAN_API_BASE}/genres/anime`);
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                allGenres = data.data;
                populateGenreFilter(allGenres);
            }
        } catch (error) {
            console.error('Error loading genres:', error);
        }
    };
    
    // Populate genre filter dropdown
    const populateGenreFilter = (genres) => {
        genreSelect.innerHTML = '';
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.mal_id;
            option.textContent = genre.name;
            genreSelect.appendChild(option);
        });
    };
    
    // Load anime queue based on filters and preferences
    const loadAnimeQueue = async () => {
        if (animeQueue.length > 5) return; // Only load more if queue is getting low
        
        try {
            // Show loading state
            animeTitle.textContent = 'Loading...';
            animeSynopsis.textContent = 'Finding your next anime...';
            animeImage.src = 'https://via.placeholder.com/400x225';
            animeGenres.innerHTML = '';
            
            // Build query parameters based on filters and preferences
            let queryParams = new URLSearchParams();
            
            // Apply genre filters if any
            if (filters.genres.length > 0) {
                queryParams.append('genres', filters.genres.join(','));
            }
            
            // Apply year filter if set
            if (filters.yearMin) {
                queryParams.append('start_date', `${filters.yearMin}-01-01`);
            }
            if (filters.yearMax) {
                queryParams.append('end_date', `${filters.yearMax}-12-31`);
            }
            
            // Apply score filter
            if (filters.scoreMin > 0) {
                queryParams.append('min_score', filters.scoreMin);
            }
            
            // Add order by score for better recommendations
            queryParams.append('order_by', 'score');
            queryParams.append('sort', 'desc');
            
            // Get a random page to increase variety
            const randomPage = Math.floor(Math.random() * 20) + 1;
            queryParams.append('page', randomPage);
            
            // Fetch anime list
            console.log(`Fetching anime from: ${JIKAN_API_BASE}/anime?${queryParams.toString()}`);
            const response = await fetch(`${JIKAN_API_BASE}/anime?${queryParams.toString()}`);
            
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                console.log(`Received ${data.data.length} anime from API`);
                // Filter out anime that are already saved
                const newAnime = data.data.filter(anime => 
                    !savedAnimes.some(saved => saved.mal_id === anime.mal_id) &&
                    !seenAnimes.some(seen => seen.mal_id === anime.mal_id)
                );
                
                // Add to queue
                animeQueue = [...animeQueue, ...newAnime];
                console.log(`Added ${newAnime.length} new anime to queue. Queue size: ${animeQueue.length}`);
                
                // Display first anime if none is currently displayed
                if (!currentAnime) {
                    displayNextAnime();
                }
            } else {
                console.warn('No anime found in API response');
                animeTitle.textContent = 'No anime found';
                animeSynopsis.textContent = 'Try adjusting your filters';
            }
        } catch (error) {
            console.error('Error loading anime:', error);
            animeTitle.textContent = 'Error loading anime';
            animeSynopsis.textContent = `Please try again later. Error: ${error.message}`;
        }
    };
    
    // Display the next anime in the queue
    const displayNextAnime = () => {
        if (animeQueue.length === 0) {
            loadAnimeQueue();
            return;
        }
        
        currentAnime = animeQueue.shift();
        displayAnime(currentAnime);
        
        // If queue is getting low, load more anime
        if (animeQueue.length < 3) {
            setTimeout(loadAnimeQueue, RATE_LIMIT_DELAY);
        }
    };

    // Display anime details on the card
    const displayAnime = (anime) => {
        animeTitle.textContent = anime.title;
        animeSynopsis.textContent = anime.synopsis || 'No synopsis available';
        animeImage.src = anime.images.jpg.large_image_url || anime.images.jpg.image_url;
        animeYear.textContent = anime.year ? `Year: ${anime.year}` : '';
        animeEpisodes.textContent = `Episodes: ${anime.episodes || 'Unknown'}`;
        animeScore.textContent = anime.score ? `Score: ${anime.score}` : '';
        
        // Display genres
        animeGenres.innerHTML = '';
        if (anime.genres && anime.genres.length > 0) {
            anime.genres.forEach(genre => {
                const genreTag = document.createElement('span');
                genreTag.className = 'genre-tag';
                genreTag.textContent = genre.name;
                animeGenres.appendChild(genreTag);
            });
        }
        
        // Add animation class
        const card = document.querySelector('.card');
        card.classList.remove('fade-in');
        void card.offsetWidth; // Trigger reflow
        card.classList.add('fade-in');
    };

    // Save anime to favorites and update user preferences
    const saveAnime = () => {
        if (!currentAnime) return;
        
        // Check if anime is already saved
        if (!savedAnimes.some(anime => anime.mal_id === currentAnime.mal_id)) {
            savedAnimes.push(currentAnime);
            localStorage.setItem('savedAnimes', JSON.stringify(savedAnimes));
            updateSavedList();
            
            // Update user preferences based on this anime
            updateUserPreferences(currentAnime);
        }
    };

    // Update user preferences based on liked anime
    const updateUserPreferences = (anime) => {
        // Update genre preferences
        if (anime.genres) {
            anime.genres.forEach(genre => {
                if (!userPreferences.genres[genre.mal_id]) {
                    userPreferences.genres[genre.mal_id] = 1;
                } else {
                    userPreferences.genres[genre.mal_id]++;
                }
            });
        }
        
        // Update studio preferences
        if (anime.studios) {
            anime.studios.forEach(studio => {
                if (!userPreferences.studios[studio.mal_id]) {
                    userPreferences.studios[studio.mal_id] = 1;
                } else {
                    userPreferences.studios[studio.mal_id]++;
                }
            });
        }
        
        // Update theme preferences
        if (anime.themes) {
            anime.themes.forEach(theme => {
                if (!userPreferences.themes[theme.mal_id]) {
                    userPreferences.themes[theme.mal_id] = 1;
                } else {
                    userPreferences.themes[theme.mal_id]++;
                }
            });
        }
        
        // Update rating preference
        if (anime.score) {
            const scoreRounded = Math.floor(anime.score);
            if (!userPreferences.ratings[scoreRounded]) {
                userPreferences.ratings[scoreRounded] = 1;
            } else {
                userPreferences.ratings[scoreRounded]++;
            }
        }
        
        // Save updated preferences
        localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
    };

    // Update the saved anime list in the UI
    const updateSavedList = () => {
        savedList.innerHTML = '';
        
        if (savedAnimes.length === 0) {
            savedList.innerHTML = '<li class="saved-item">No saved anime yet</li>';
            return;
        }
        
        savedAnimes.forEach(anime => {
            const listItem = document.createElement('li');
            listItem.className = 'saved-item';
            listItem.innerHTML = `
                <h4>${anime.title}</h4>
                <p>${anime.score ? `Score: ${anime.score}` : ''}</p>
            `;
            
            // Add click event to show details
            listItem.addEventListener('click', () => showAnimeDetails(anime));
            
            savedList.appendChild(listItem);
        });
    };

    // Update the seen anime list in the UI
    const updateSeenList = () => {
        seenList.innerHTML = '';
        
        if (seenAnimes.length === 0) {
            seenList.innerHTML = '<li class="seen-item">No seen anime yet</li>';
            return;
        }
        
        seenAnimes.forEach(anime => {
            const listItem = document.createElement('li');
            listItem.className = 'seen-item';
            listItem.innerHTML = `
                <h4>${anime.title}</h4>
                <p>${anime.score ? `Score: ${anime.score}` : ''}</p>
            `;
            
            // Add click event to show details
            listItem.addEventListener('click', () => showAnimeDetails(anime));
            
            seenList.appendChild(listItem);
        });
    };

    // Show detailed anime information in modal
    const showAnimeDetails = (anime) => {
        modalContent.innerHTML = `
            <div class="anime-detail">
                <div class="detail-header">
                    <img src="${anime.images.jpg.large_image_url || anime.images.jpg.image_url}" alt="${anime.title}">
                    <div>
                        <h2>${anime.title}</h2>
                        <p>${anime.title_japanese || ''}</p>
                        <div class="detail-info">
                            ${anime.year ? `<span>Year: ${anime.year}</span>` : ''}
                            <span>Episodes: ${anime.episodes || 'Unknown'}</span>
                            ${anime.score ? `<span>Score: ${anime.score}</span>` : ''}
                            ${anime.rating ? `<span>Rating: ${anime.rating}</span>` : ''}
                        </div>
                        <div class="genres">
                            ${anime.genres ? anime.genres.map(genre => `<span class="genre-tag">${genre.name}</span>`).join('') : ''}
                        </div>
                    </div>
                </div>
                <div class="detail-synopsis">
                    <h3>Synopsis</h3>
                    <p>${anime.synopsis || 'No synopsis available'}</p>
                </div>
                <div class="detail-actions">
                    <button class="action-button remove-button" data-id="${anime.mal_id}">Remove from Saved</button>
                </div>
            </div>
        `;
        
        // Add event listener to remove button
        const removeButton = modalContent.querySelector('.remove-button');
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                const animeId = parseInt(removeButton.getAttribute('data-id'));
                removeSavedAnime(animeId);
                closeModalWindow();
            });
        }
        
        modal.style.display = 'block';
    };

    // Remove anime from saved list
    const removeSavedAnime = (animeId) => {
        savedAnimes = savedAnimes.filter(anime => anime.mal_id !== animeId);
        localStorage.setItem('savedAnimes', JSON.stringify(savedAnimes));
        updateSavedList();
    };

    // Save anime to seen list
    const markAsSeen = () => {
        if (!currentAnime) return;
        
        // Check if anime is already seen
        if (!seenAnimes.some(anime => anime.mal_id === currentAnime.mal_id)) {
            seenAnimes.push(currentAnime);
            localStorage.setItem('seenAnimes', JSON.stringify(seenAnimes));
            updateSeenList();
        }
    };

    // Close the modal window
    const closeModalWindow = () => {
        modal.style.display = 'none';
    };

    // Apply filters from the UI
    const applyFilters = () => {
        // Get selected genres
        filters.genres = Array.from(genreSelect.selectedOptions).map(option => option.value);
        
        // Get year range
        filters.yearMin = yearMin.value ? parseInt(yearMin.value) : null;
        filters.yearMax = yearMax.value ? parseInt(yearMax.value) : null;
        
        // Get minimum score
        filters.scoreMin = parseFloat(scoreMin.value);
        
        // Clear current queue and load new anime
        animeQueue = [];
        loadAnimeQueue();
        
        // Hide filter panel
        filterContent.classList.add('hidden');
    };

    // Reset all filters
    const resetFilters = () => {
        genreSelect.querySelectorAll('option').forEach(option => {
            option.selected = false;
        });
        
        yearMin.value = '';
        yearMax.value = '';
        scoreMin.value = 0;
        scoreValue.textContent = '0';
        
        filters = {
            genres: [],
            yearMin: null,
            yearMax: null,
            scoreMin: 0
        };
        
        // Clear current queue and load new anime
        animeQueue = [];
        loadAnimeQueue();
    };

    // Setup touch and mouse events for swipe gestures
    const setupTouchEvents = () => {
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;
        let isMouseDown = false;

        // Create touch area if it doesn't exist
        let touchArea = document.querySelector('.touch-area');
        if (!touchArea) {
            touchArea = document.createElement('div');
            touchArea.className = 'touch-area';
            const cardContainer = document.querySelector('.card-container');
            if (cardContainer) {
                cardContainer.appendChild(touchArea);
            }
        }

        // Touch events
        touchArea.addEventListener('touchstart', (event) => {
            event.preventDefault(); // Prevent scrolling
            const touch = event.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        });

        touchArea.addEventListener('touchend', (event) => {
            event.preventDefault();
            const touch = event.changedTouches[0];
            endX = touch.clientX;
            endY = touch.clientY;
            handleSwipeGesture();
        });

        // Mouse events
        touchArea.addEventListener('mousedown', (event) => {
            event.preventDefault();
            isMouseDown = true;
            startX = event.clientX;
            startY = event.clientY;
        });

        touchArea.addEventListener('mouseup', (event) => {
            event.preventDefault();
            if (isMouseDown) {
                endX = event.clientX;
                endY = event.clientY;
                isMouseDown = false;
                handleSwipeGesture();
            }
        });

        touchArea.addEventListener('mouseleave', (event) => {
            if (isMouseDown) {
                endX = event.clientX;
                endY = event.clientY;
                isMouseDown = false;
                handleSwipeGesture();
            }
        });

        // Make sure buttons still work
        const ensureButtonsWork = () => {
            const buttons = document.querySelectorAll('.swipe-button');
            buttons.forEach(button => {
                button.addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent the touch area from capturing the event
                });
            });
        };
        
        ensureButtonsWork();
    };

    // Handle swipe gestures
    const handleSwipeGesture = () => {
        const diffX = endX - startX;
        const diffY = endY - startY;
        const minSwipeDistance = 50; // Minimum distance to count as a swipe

        // Only process if there was significant movement
        if (Math.abs(diffX) < minSwipeDistance && Math.abs(diffY) < minSwipeDistance) {
            return; // Not a swipe, just a tap
        }

        const card = document.querySelector('.card');
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal swipe
            if (diffX > minSwipeDistance) {
                // Swipe right
                if (card) card.classList.add('swipe-right-animation');
                setTimeout(() => {
                    saveAnime();
                    if (card) card.classList.remove('swipe-right-animation');
                    displayNextAnime();
                }, 500);
            } else if (diffX < -minSwipeDistance) {
                // Swipe left
                if (card) card.classList.add('swipe-left-animation');
                setTimeout(() => {
                    if (card) card.classList.remove('swipe-left-animation');
                    displayNextAnime();
                }, 500);
            }
        } else {
            // Vertical swipe
            if (diffY < -minSwipeDistance) {
                // Swipe up
                if (card) card.classList.add('swipe-up-animation');
                setTimeout(() => {
                    markAsSeen();
                    if (card) card.classList.remove('swipe-up-animation');
                    displayNextAnime();
                }, 500);
            } else if (diffY > minSwipeDistance) {
                // Swipe down
                displayNextAnime();
            }
        }
    };

    // Setup all event listeners
    const setupEventListeners = () => {
        // Swipe buttons
        swipeLeftButton.addEventListener('click', () => {
            const card = document.querySelector('.card');
            if (card) card.classList.add('swipe-left-animation');
            setTimeout(() => {
                if (card) card.classList.remove('swipe-left-animation');
                displayNextAnime();
            }, 500);
        });
        
        swipeRightButton.addEventListener('click', () => {
            const card = document.querySelector('.card');
            if (card) card.classList.add('swipe-right-animation');
            setTimeout(() => {
                saveAnime();
                if (card) card.classList.remove('swipe-right-animation');
                displayNextAnime();
            }, 500);
        });

        swipeUpButton.addEventListener('click', () => {
            const card = document.querySelector('.card');
            if (card) card.classList.add('swipe-up-animation');
            setTimeout(() => {
                markAsSeen();
                if (card) card.classList.remove('swipe-up-animation');
                displayNextAnime();
            }, 500);
        });
        
        // Panel toggle buttons
        filterButton.addEventListener('click', () => {
            filterContent.classList.toggle('hidden');
            savedContent.classList.add('hidden');
            seenContent.classList.add('hidden');
        });
        
        savedButton.addEventListener('click', () => {
            savedContent.classList.toggle('hidden');
            filterContent.classList.add('hidden');
            seenContent.classList.add('hidden');
        });

        seenButton.addEventListener('click', () => {
            seenContent.classList.toggle('hidden');
            filterContent.classList.add('hidden');
            savedContent.classList.add('hidden');
        });

        // Filter controls
        scoreMin.addEventListener('input', () => {
            scoreValue.textContent = scoreMin.value;
        });
        
        applyFiltersButton.addEventListener('click', applyFilters);
        resetFiltersButton.addEventListener('click', resetFilters);
        
        // Modal close button
        closeModal.addEventListener('click', closeModalWindow);
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModalWindow();
            }
        });
    };

    // Start the app
    init();
});
