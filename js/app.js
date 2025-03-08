document.addEventListener('DOMContentLoaded', () => {
    // Constants
    const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
    const STORAGE_KEYS = {
        SAVED_ANIME: 'animeVault_savedAnime',
        SEEN_ANIME: 'animeVault_seenAnime',
        FILTERS: 'animeVault_filters'
    };

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
    let genres = [];
    let filters = JSON.parse(localStorage.getItem(STORAGE_KEYS.FILTERS)) || {
        genres: [],
        yearMin: null,
        yearMax: null,
        scoreMin: 0
    };

    // Initialize the app
    const init = async () => {
        try {
            await loadGenres();
            populateGenreSelect();
            applyStoredFilters();
            await loadAnimeQueue();
            displayNextAnime();
            setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            animeSynopsis.textContent = 'Error loading data. Please try refreshing the page.';
        }
    };

    // Load available genres from API
    const loadGenres = async () => {
        try {
            console.log('Fetching genres from API...');
            const response = await fetch(`${JIKAN_API_BASE}/genres/anime`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Genres fetched successfully:', data);
            genres = data.data;
        } catch (error) {
            console.error('Error loading genres:', error);
            throw new Error('Failed to load genres. Please check your connection and try again.');
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
                queryParams.append('genres', filters.genres.join(','));
            }
            
            // Add year range if specified
            if (filters.yearMin) {
                queryParams.append('start_date', `${filters.yearMin}-01-01`);
            }
            if (filters.yearMax) {
                queryParams.append('end_date', `${filters.yearMax}-12-31`);
            }
            
            // Add minimum score
            if (filters.scoreMin > 0) {
                queryParams.append('min_score', filters.scoreMin);
            }
            
            // Add sorting and pagination
            queryParams.append('sort', 'score');
            queryParams.append('order_by', 'desc');
            queryParams.append('limit', 25);
            queryParams.append('page', Math.floor(Math.random() * 5) + 1); // Random page for variety
            
            console.log(`API request: ${JIKAN_API_BASE}/anime?${queryParams.toString()}`);
            
            // Fetch anime list
            const response = await fetch(`${JIKAN_API_BASE}/anime?${queryParams.toString()}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Anime data fetched successfully:', data);
            
            // Filter out already saved or seen anime
            animeQueue = data.data.filter(anime => 
                !savedAnime.some(saved => saved.mal_id === anime.mal_id) && 
                !seenAnime.some(seen => seen.mal_id === anime.mal_id)
            );
            
            // If queue is empty, try with different filters
            if (animeQueue.length === 0) {
                console.log('No new anime found with current filters. Trying with broader criteria...');
                // Reset filters temporarily to get more results
                const tempQueryParams = new URLSearchParams();
                tempQueryParams.append('sort', 'score');
                tempQueryParams.append('order_by', 'desc');
                tempQueryParams.append('limit', 25);
                tempQueryParams.append('page', Math.floor(Math.random() * 10) + 1);
                
                const tempResponse = await fetch(`${JIKAN_API_BASE}/anime?${tempQueryParams.toString()}`);
                
                if (!tempResponse.ok) {
                    throw new Error(`API error: ${tempResponse.status} - ${tempResponse.statusText}`);
                }
                
                const tempData = await tempResponse.json();
                animeQueue = tempData.data.filter(anime => 
                    !savedAnime.some(saved => saved.mal_id === anime.mal_id) && 
                    !seenAnime.some(seen => seen.mal_id === anime.mal_id)
                );
            }
            
            // Shuffle the queue for variety
            animeQueue = shuffleArray(animeQueue);
            
            console.log(`Loaded ${animeQueue.length} anime into queue`);
        } catch (error) {
            console.error('Error loading anime queue:', error);
            throw new Error('Failed to load anime. Please check your connection and try again.');
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
            displayNextAnime();
        });

        seenButton.addEventListener('click', () => {
            markAsSeen();
            displayNextAnime();
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
