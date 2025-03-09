document.addEventListener('DOMContentLoaded', () => {
    // Constants
    const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
    const STORAGE_KEYS = {
        SAVED_ANIME: 'animeVault_savedAnime',
        SEEN_ANIME: 'animeVault_seenAnime',
        SHOWN_ANIME: 'animeVault_shownAnime', // New key for tracking shown anime
        FILTERS: 'animeVault_filters'
    };
    const DELAY_BETWEEN_REQUESTS = 4000; // 4 seconds between requests to respect rate limits
    const MAX_RETRIES = 3; // Maximum number of retries for API requests
    const MAX_SHOWN_HISTORY = 100; // Maximum number of anime to keep in shown history

    // DOM Elements
    const animeImage = document.getElementById('anime-image');
    const animeTitle = document.getElementById('anime-title');
    const animeYear = document.getElementById('anime-year');
    const animeEpisodes = document.getElementById('anime-episodes');
    const animeScore = document.getElementById('anime-score');
    const animeSynopsis = document.getElementById('anime-synopsis');
    const animeGenres = document.getElementById('anime-genres');
    
    // Action buttons
    const skipButton = document.getElementById('skip-button');
    const saveButton = document.getElementById('save-button');
    const seenButton = document.getElementById('seen-button');
    
    // Filter elements
    const filterButton = document.getElementById('filter-button');
    const filterContent = document.getElementById('filter-content');
    const genreSelect = document.getElementById('genre-select');
    const yearMin = document.getElementById('year-min');
    const yearMax = document.getElementById('year-max');
    const scoreMin = document.getElementById('score-min');
    const scoreValue = document.getElementById('score-value');
    const applyFiltersButton = document.getElementById('apply-filters');
    const resetFiltersButton = document.getElementById('reset-filters');
    
    // Saved and Seen anime panels
    const savedListButton = document.getElementById('saved-list-button');
    const savedContent = document.getElementById('saved-content');
    const savedList = document.getElementById('saved-list');
    const seenListButton = document.getElementById('seen-list-button');
    const seenContent = document.getElementById('seen-content');
    const seenList = document.getElementById('seen-list');
    
    // Modal elements
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    const closeModal = document.querySelector('.close');
    
    // State
    let animeQueue = [];
    let currentAnime = null;
    let savedAnime = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_ANIME)) || [];
    let seenAnime = JSON.parse(localStorage.getItem(STORAGE_KEYS.SEEN_ANIME)) || [];
    let shownAnime = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_ANIME)) || []; // Track previously shown anime
    let genres = [];
    let filters = JSON.parse(localStorage.getItem(STORAGE_KEYS.FILTERS)) || {
        genres: [],
        yearMin: null,
        yearMax: null,
        scoreMin: 0
    };

    // Helper function to make API requests with retries
    const fetchWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
        try {
            console.log(`Fetching: ${url} (Retries left: ${retries})`);
            const response = await fetch(url, options);
            
            if (response.status === 429) {
                // Rate limited - wait longer and retry
                console.warn('Rate limited by API, waiting longer before retry...');
                const retryAfter = response.headers.get('Retry-After') || 5;
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} - ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            if (retries > 0) {
                // Exponential backoff
                const waitTime = DELAY_BETWEEN_REQUESTS * (MAX_RETRIES - retries + 1);
                console.warn(`Request failed, retrying in ${waitTime/1000} seconds...`, error);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    };

    // Initialize the app
    const init = async () => {
        try {
            // Show loading state
            animeTitle.textContent = 'Loading...';
            animeSynopsis.textContent = 'Loading anime data...';
            animeImage.src = 'https://via.placeholder.com/400x225?text=Loading...';
            
            console.log('Initializing application...');
            
            // Load saved and seen anime from localStorage
            savedAnime = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_ANIME)) || [];
            seenAnime = JSON.parse(localStorage.getItem(STORAGE_KEYS.SEEN_ANIME)) || [];
            shownAnime = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_ANIME)) || [];
            
            console.log(`Loaded ${savedAnime.length} saved anime, ${seenAnime.length} seen anime, and ${shownAnime.length} previously shown anime from localStorage`);
            
            // Update lists in UI
            updateSavedList();
            updateSeenList();
            
            // Initialize with a delay to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
                await loadGenres();
                populateGenreSelect();
                applyStoredFilters();
                
                try {
                    await loadAnimeQueue();
                    displayNextAnime();
                } catch (queueError) {
                    console.error('Failed to load anime queue:', queueError);
                    animeTitle.textContent = 'Error Loading Anime';
                    animeSynopsis.textContent = `Error: ${queueError.message}. Please try refreshing the page or adjusting your filters.`;
                }
            } catch (genreError) {
                console.error('Failed to load genres:', genreError);
                // Still try to load anime even if genres fail
                try {
                    await loadAnimeQueue();
                    displayNextAnime();
                } catch (queueError) {
                    console.error('Failed to load anime queue:', queueError);
                    animeTitle.textContent = 'Error Loading Anime';
                    animeSynopsis.textContent = `Error: ${queueError.message}. Please try refreshing the page or adjusting your filters.`;
                }
            }
            
            setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            animeTitle.textContent = 'Error';
            animeSynopsis.textContent = `Error loading data: ${error.message}. Please try refreshing the page.`;
        }
    };

    // Load available genres from API
    const loadGenres = async () => {
        try {
            console.log('Fetching genres from API...');
            
            const options = {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors'
            };
            
            const response = await fetchWithRetry(`${JIKAN_API_BASE}/genres/anime`, options);
            const data = await response.json();
            
            console.log('Genres fetched successfully:', data);
            genres = data.data;
            
            if (!genres || genres.length === 0) {
                console.warn('No genres found in API response');
                throw new Error('No genres found in API response');
            }
        } catch (error) {
            console.error('Error loading genres:', error);
            throw error;
        }
    };

    // Populate genre select dropdown
    const populateGenreSelect = () => {
        genreSelect.innerHTML = '';
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.mal_id;
            option.textContent = genre.name;
            option.selected = filters.genres.includes(parseInt(genre.mal_id));
            genreSelect.appendChild(option);
        });
    };

    // Apply stored filters to the UI
    const applyStoredFilters = () => {
        if (filters.yearMin) yearMin.value = filters.yearMin;
        if (filters.yearMax) yearMax.value = filters.yearMax;
        scoreMin.value = filters.scoreMin;
        scoreValue.textContent = filters.scoreMin;
    };

    // Load anime queue based on filters
    const loadAnimeQueue = async () => {
        try {
            console.log('Loading anime queue with filters:', filters);
            
            // Build query parameters
            const queryParams = new URLSearchParams();
            
            // Add genres if selected
            if (filters.genres.length > 0) {
                // Jikan API v4 uses 'genres' parameter
                queryParams.append('genres', filters.genres.join(','));
            }
            
            // Add year range if specified
            if (filters.yearMin) {
                queryParams.append('start_date', `${filters.yearMin}`);
            }
            if (filters.yearMax) {
                queryParams.append('end_date', `${filters.yearMax}`);
            }
            
            // Add minimum score
            if (filters.scoreMin > 0) {
                queryParams.append('min_score', filters.scoreMin);
            }
            
            // Add sorting and pagination
            queryParams.append('order_by', 'score');
            queryParams.append('sort', 'desc');
            queryParams.append('limit', 25); // Increased from 20 to 25
            
            // Use a wider range of pages for more variety
            const randomPage = Math.floor(Math.random() * 5) + 1; // Random page 1-5 instead of 1-3
            queryParams.append('page', randomPage);
            
            const url = `${JIKAN_API_BASE}/anime?${queryParams.toString()}`;
            console.log(`API request: ${url}`);
            
            // Fetch anime list
            const options = {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                mode: 'cors'
            };
            
            const response = await fetchWithRetry(url, options);
            const data = await response.json();
            
            console.log('Anime data fetched successfully:', data);
            
            if (!data.data || data.data.length === 0) {
                console.warn('No anime found in API response');
                throw new Error('No anime found in API response');
            }
            
            // Get all anime IDs to exclude (saved, seen, and previously shown)
            const excludeIds = [
                ...savedAnime.map(anime => anime.mal_id),
                ...seenAnime.map(anime => anime.mal_id),
                ...shownAnime.map(anime => anime.mal_id)
            ];
            
            // Filter out already saved, seen, or previously shown anime
            animeQueue = data.data.filter(anime => !excludeIds.includes(anime.mal_id));
            
            // If queue is empty or too small, try with different filters
            if (animeQueue.length < 5) {
                console.log('Not enough new anime found with current filters. Trying with broader criteria...');
                
                // Try more pages with the same filters first (maintaining genre selection)
                let additionalAnime = [];
                
                // Try up to 3 more pages with the same filters
                for (let i = 0; i < 3 && additionalAnime.length < 10; i++) {
                    const newPage = ((randomPage + i) % 5) + 1; // Cycle through pages 1-5
                    const tempQueryParams = new URLSearchParams(queryParams);
                    tempQueryParams.set('page', newPage);
                    
                    let tempUrl = `${JIKAN_API_BASE}/anime?${tempQueryParams.toString()}`;
                    console.log(`Trying different page with same filters: ${tempUrl}`);
                    
                    try {
                        let tempResponse = await fetchWithRetry(tempUrl, options);
                        let tempData = await tempResponse.json();
                        
                        // Filter the new results
                        if (tempData.data && tempData.data.length > 0) {
                            const newAnime = tempData.data.filter(anime => !excludeIds.includes(anime.mal_id));
                            additionalAnime = [...additionalAnime, ...newAnime];
                        }
                    } catch (error) {
                        console.warn(`Error fetching additional page ${newPage}:`, error);
                        // Continue with the next iteration
                    }
                    
                    // Add a small delay between requests to respect API rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                animeQueue = [...animeQueue, ...additionalAnime];
                
                // If still not enough, try with slightly broader criteria but KEEP the genre filter
                if (animeQueue.length < 5) {
                    // Create broader params but maintain genre filter
                    const broaderQueryParams = new URLSearchParams();
                    
                    // IMPORTANT: Keep the genre filter
                    if (filters.genres.length > 0) {
                        broaderQueryParams.append('genres', filters.genres.join(','));
                    }
                    
                    // Remove other restrictive filters but keep sorting
                    broaderQueryParams.append('order_by', 'score');
                    broaderQueryParams.append('sort', 'desc');
                    broaderQueryParams.append('limit', 25);
                    broaderQueryParams.append('page', Math.floor(Math.random() * 10) + 1); // Try a wider range of pages
                    
                    const tempUrl = `${JIKAN_API_BASE}/anime?${broaderQueryParams.toString()}`;
                    console.log(`Broader API request (keeping genre): ${tempUrl}`);
                    
                    try {
                        const tempResponse = await fetchWithRetry(tempUrl, options);
                        const tempData = await tempResponse.json();
                        
                        if (tempData.data && tempData.data.length > 0) {
                            const broaderAnime = tempData.data.filter(anime => !excludeIds.includes(anime.mal_id));
                            animeQueue = [...animeQueue, ...broaderAnime];
                        }
                    } catch (error) {
                        console.warn('Error fetching with broader criteria:', error);
                        // Continue with what we have
                    }
                }
                
                // Only as a last resort, if we still don't have enough and there are genres selected,
                // check if we've shown most available anime in this genre
                if (animeQueue.length < 3 && filters.genres.length > 0) {
                    try {
                        // Check how many total anime exist for this genre
                        const genreCheckUrl = `${JIKAN_API_BASE}/anime?genres=${filters.genres.join(',')}&limit=1`;
                        const genreCheckResponse = await fetchWithRetry(genreCheckUrl, options);
                        const genreCheckData = await genreCheckResponse.json();
                        
                        if (genreCheckData.pagination && genreCheckData.pagination.items) {
                            const totalInGenre = genreCheckData.pagination.items.total;
                            const totalShownInGenre = shownAnime.filter(anime => 
                                anime.genres && anime.genres.some(g => filters.genres.includes(g.mal_id))
                            ).length;
                            
                            console.log(`Total anime in selected genre(s): ${totalInGenre}, Total shown: ${totalShownInGenre}`);
                            
                            // If we've shown a significant portion of available anime in this genre
                            if (totalShownInGenre > totalInGenre * 0.5 || totalShownInGenre > 40) {
                                console.log('You have seen most anime in this genre. Consider trying a different genre.');
                                // No longer clearing history - we'll just show the "no more anime" message when appropriate
                            }
                        }
                    } catch (error) {
                        console.warn('Error checking genre totals:', error);
                        // Continue with what we have
                    }
                }
            }
            
            // Shuffle the queue for variety
            animeQueue = shuffleArray(animeQueue);
            
            console.log(`Loaded ${animeQueue.length} anime into queue`);
            
            if (animeQueue.length === 0) {
                // No longer clearing history to allow repeats
                // Just inform the user there are no more anime matching their criteria
                throw new Error('No more anime found that you haven\'t already saved, seen, or been shown. Try different filters!');
            }
        } catch (error) {
            console.error('Error loading anime queue:', error);
            throw error;
        }
    };

    // Display the next anime in the queue
    const displayNextAnime = async () => {
        if (animeQueue.length === 0) {
            try {
                await loadAnimeQueue();
                if (animeQueue.length === 0) {
                    displayNoMoreAnime();
                    return;
                }
            } catch (error) {
                console.error('Error refreshing anime queue:', error);
                animeSynopsis.textContent = 'Error loading more anime. Please try refreshing the page.';
                return;
            }
        }
        
        currentAnime = animeQueue.shift();
        
        // Add to shown anime history
        if (!shownAnime.some(anime => anime.mal_id === currentAnime.mal_id)) {
            shownAnime.push({
                mal_id: currentAnime.mal_id,
                title: currentAnime.title
            });
            
            // Limit the size of shown anime history
            if (shownAnime.length > MAX_SHOWN_HISTORY) {
                shownAnime = shownAnime.slice(shownAnime.length - MAX_SHOWN_HISTORY);
            }
            
            // Save to localStorage
            localStorage.setItem(STORAGE_KEYS.SHOWN_ANIME, JSON.stringify(shownAnime));
        }
        
        // Update UI with anime details
        animeImage.src = currentAnime.images.jpg.large_image_url || 'https://via.placeholder.com/400x225?text=No+Image';
        animeTitle.textContent = currentAnime.title;
        animeYear.textContent = currentAnime.year ? `${currentAnime.year}` : 'Year: Unknown';
        animeEpisodes.textContent = currentAnime.episodes ? `${currentAnime.episodes} eps` : 'Episodes: Unknown';
        animeScore.textContent = currentAnime.score ? `★ ${currentAnime.score}` : 'Score: N/A';
        animeSynopsis.textContent = currentAnime.synopsis || 'No synopsis available.';
        
        // Display genres
        animeGenres.innerHTML = '';
        if (currentAnime.genres && currentAnime.genres.length > 0) {
            currentAnime.genres.forEach(genre => {
                const genreTag = document.createElement('span');
                genreTag.className = 'genre-tag';
                genreTag.textContent = genre.name;
                animeGenres.appendChild(genreTag);
            });
        }
    };

    // Display message when no more anime are available
    const displayNoMoreAnime = () => {
        animeImage.src = 'https://via.placeholder.com/400x225?text=No+More+Anime';
        animeTitle.textContent = 'No More Anime Found';
        animeYear.textContent = '';
        animeEpisodes.textContent = '';
        animeScore.textContent = '';
        animeSynopsis.textContent = 'We couldn\'t find any more anime matching your criteria. Try adjusting your filters or check back later!';
        animeGenres.innerHTML = '';
    };

    // Save current anime to saved list
    const saveAnime = () => {
        if (!currentAnime) return;
        
        // Check if already saved
        if (!savedAnime.some(anime => anime.mal_id === currentAnime.mal_id)) {
            savedAnime.push(currentAnime);
            localStorage.setItem(STORAGE_KEYS.SAVED_ANIME, JSON.stringify(savedAnime));
            updateSavedList();
        }
        
        displayNextAnime();
    };

    // Mark current anime as seen
    const markAsSeen = () => {
        if (!currentAnime) return;
        
        // Check if already marked as seen
        if (!seenAnime.some(anime => anime.mal_id === currentAnime.mal_id)) {
            seenAnime.push(currentAnime);
            localStorage.setItem(STORAGE_KEYS.SEEN_ANIME, JSON.stringify(seenAnime));
            updateSeenList();
        }
        
        displayNextAnime();
    };

    // Update saved anime list in UI
    const updateSavedList = () => {
        savedList.innerHTML = '';
        
        if (savedAnime.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.textContent = 'No saved anime yet.';
            savedList.appendChild(emptyMessage);
            return;
        }
        
        savedAnime.forEach(anime => {
            const listItem = document.createElement('li');
            listItem.className = 'saved-item';
            listItem.textContent = anime.title;
            listItem.addEventListener('click', () => showAnimeDetails(anime));
            savedList.appendChild(listItem);
        });
    };

    // Update seen anime list in UI
    const updateSeenList = () => {
        seenList.innerHTML = '';
        
        if (seenAnime.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.textContent = 'No seen anime yet.';
            seenList.appendChild(emptyMessage);
            return;
        }
        
        seenAnime.forEach(anime => {
            const listItem = document.createElement('li');
            listItem.className = 'seen-item';
            listItem.textContent = anime.title;
            listItem.addEventListener('click', () => showAnimeDetails(anime));
            seenList.appendChild(listItem);
        });
    };

    // Show detailed information about an anime in a modal
    const showAnimeDetails = (anime) => {
        modalContent.innerHTML = `
            <div class="modal-anime">
                <img src="${anime.images.jpg.large_image_url || 'https://via.placeholder.com/400x225?text=No+Image'}" alt="${anime.title}">
                <h2>${anime.title}</h2>
                <p><strong>Original Title:</strong> ${anime.title_japanese || 'N/A'}</p>
                <p><strong>Year:</strong> ${anime.year || 'Unknown'}</p>
                <p><strong>Episodes:</strong> ${anime.episodes || 'Unknown'}</p>
                <p><strong>Score:</strong> ${anime.score || 'N/A'}</p>
                <p><strong>Genres:</strong> ${anime.genres.map(g => g.name).join(', ') || 'N/A'}</p>
                <p><strong>Synopsis:</strong> ${anime.synopsis || 'No synopsis available.'}</p>
                <p><a href="${anime.url}" target="_blank">View on MyAnimeList</a></p>
            </div>
        `;
        modal.style.display = 'block';
    };

    // Setup all event listeners
    const setupEventListeners = () => {
        // Action buttons
        skipButton.addEventListener('click', () => {
            displayNextAnime();
        });
        
        saveButton.addEventListener('click', () => {
            saveAnime();
        });

        seenButton.addEventListener('click', () => {
            markAsSeen();
        });
        
        // Panel toggle buttons
        filterButton.addEventListener('click', () => {
            filterContent.classList.toggle('hidden');
            savedContent.classList.add('hidden');
            seenContent.classList.add('hidden');
        });
        
        savedListButton.addEventListener('click', () => {
            savedContent.classList.toggle('hidden');
            filterContent.classList.add('hidden');
            seenContent.classList.add('hidden');
            updateSavedList();
        });
        
        seenListButton.addEventListener('click', () => {
            seenContent.classList.toggle('hidden');
            filterContent.classList.add('hidden');
            savedContent.classList.add('hidden');
            updateSeenList();
        });
        
        // Filter controls
        scoreMin.addEventListener('input', () => {
            scoreValue.textContent = scoreMin.value;
        });
        
        applyFiltersButton.addEventListener('click', async () => {
            // Get selected genres
            const selectedGenres = Array.from(genreSelect.selectedOptions).map(option => parseInt(option.value));
            
            // Update filters
            filters = {
                genres: selectedGenres,
                yearMin: yearMin.value ? parseInt(yearMin.value) : null,
                yearMax: yearMax.value ? parseInt(yearMax.value) : null,
                scoreMin: parseFloat(scoreMin.value)
            };
            
            // Save filters to localStorage
            localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
            
            // Reload anime queue with new filters
            try {
                await loadAnimeQueue();
                displayNextAnime();
                filterContent.classList.add('hidden');
            } catch (error) {
                console.error('Error applying filters:', error);
                alert('Error applying filters. Please try again.');
            }
        });
        
        resetFiltersButton.addEventListener('click', () => {
            // Reset filter UI
            Array.from(genreSelect.options).forEach(option => {
                option.selected = false;
            });
            yearMin.value = '';
            yearMax.value = '';
            scoreMin.value = 0;
            scoreValue.textContent = '0';
            
            // Reset filters object
            filters = {
                genres: [],
                yearMin: null,
                yearMax: null,
                scoreMin: 0
            };
            
            // Save reset filters to localStorage
            localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
        });
        
        // Modal
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    };

    // Utility function to shuffle an array
    const shuffleArray = (array) => {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    };

    // Start the app
    init();
});
