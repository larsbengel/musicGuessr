import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const en = {
  common: {
    yourName: 'Your Name',
    enterUsername: 'Enter username...',
    backToHome: 'Back to Home',
    backToLobby: 'Back to Lobby',
    search: 'Search',
    join: 'Join',
    categories: { title: 'Title', artist: 'Artist', year: 'Year' },
  },
  home: {
    tagline: 'Guess songs with friends',
    createLobby: 'Create Lobby',
    creating: 'Creating...',
    lobbyCodePlaceholder: 'Lobby code (e.g. XK9FT2)',
    joinLobby: 'Join Lobby',
    errors: {
      enterUsername: 'Enter a username first',
      couldNotCreate: 'Could not create lobby',
      codeLength: 'Lobby code must be 6 characters',
    },
  },
  lobby: {
    joinLobby: 'Join Lobby',
    invitedTo: "You've been invited to lobby",
    joiningLobby: 'Joining lobby...',
    shareToInvite: 'Share to invite friends',
    players: 'Players',
    you: 'you',
    songsPerGame: 'Songs per game',
    nSongs: '{{count}} songs',
    roundLength: 'Round length',
    whatToGuess: 'What to guess',
    settings: 'Settings',
    nSongsRounds: '{{count}} songs · {{duration}}s rounds',
    guess: 'Guess',
    loadingSongs: 'Loading songs...',
    startGame: 'Start Game',
    waitingForHost: 'Waiting for host to start...',
    leaveLobby: 'Leave Lobby',
    selectedPlaylists: 'Selected Playlists',
    checkingTracks: 'checking...',
    nPlayable: '{{count}} playable',
    approxTracks: '~{{count}} tracks',
    addPlaylists: 'Add Playlists',
    searchPlaylists: 'Search playlists...',
    loading: 'Loading...',
    spotifyUnavailable: 'Spotify API is not available at the moment.',
    spotifyError: 'Could not reach Spotify.',
    searchFailed: 'Search failed.',
    maxPlaylists: 'Maximum of 8 playlists reached.',
    featured: 'Featured',
    byOwner: 'by {{owner}} · {{count}} tracks',
  },
  game: {
    songInProgress: 'Song in progress',
    gameStartingSoon: 'Game starting soon',
    clickForAudio: 'Click anywhere to enable audio',
    songOf: 'Song {{current}} of {{total}}',
    gameOver: 'Game Over!',
    finalScores: 'Final scores',
    pts: 'pts',
    playAgain: 'Play Again',
    songsPlayed: 'Songs played',
  },
  chat: {
    waitingForSong: 'Waiting for next song...',
    typeGuess: 'Type your guess...',
    song: 'Song',
    isClose: 'is close!',
    guessedSuffix: 'guessed {{label}}!',
    labels: {
      title: 'the title',
      artist: 'the artist',
      year: 'the year',
      artist_title: 'title & artist',
      title_year: 'title & year',
      artist_year: 'artist & year',
      artist_title_year: 'title, artist & year',
    },
  },
  scoreboard: {
    title: 'Scoreboard',
    noScores: 'No scores yet',
  },
};

const de: typeof en = {
  common: {
    yourName: 'Dein Name',
    enterUsername: 'Benutzername eingeben...',
    backToHome: 'Zur Startseite',
    backToLobby: 'Zurück zur Lobby',
    search: 'Suchen',
    join: 'Beitreten',
    categories: { title: 'Titel', artist: 'Künstler', year: 'Jahr' },
  },
  home: {
    tagline: 'Errate Songs mit Freunden',
    createLobby: 'Lobby erstellen',
    creating: 'Erstelle...',
    lobbyCodePlaceholder: 'Lobby-Code (z.B. XK9FT2)',
    joinLobby: 'Lobby beitreten',
    errors: {
      enterUsername: 'Bitte zuerst einen Benutzernamen eingeben',
      couldNotCreate: 'Lobby konnte nicht erstellt werden',
      codeLength: 'Der Lobby-Code muss 6 Zeichen lang sein',
    },
  },
  lobby: {
    joinLobby: 'Lobby beitreten',
    invitedTo: 'Du wurdest zur Lobby eingeladen',
    joiningLobby: 'Trete Lobby bei...',
    shareToInvite: 'Teilen um Freunde einzuladen',
    players: 'Spieler',
    you: 'du',
    songsPerGame: 'Songs pro Spiel',
    nSongs: '{{count}} Songs',
    roundLength: 'Rundenlänge',
    whatToGuess: 'Was soll erraten werden',
    settings: 'Einstellungen',
    nSongsRounds: '{{count}} Songs · {{duration}}s Runden',
    guess: 'Erraten',
    loadingSongs: 'Lade Songs...',
    startGame: 'Spiel starten',
    waitingForHost: 'Warte auf den Host...',
    leaveLobby: 'Lobby verlassen',
    selectedPlaylists: 'Ausgewählte Playlists',
    checkingTracks: 'wird geprüft...',
    nPlayable: '{{count}} spielbar',
    approxTracks: '~{{count}} Tracks',
    addPlaylists: 'Playlists hinzufügen',
    searchPlaylists: 'Playlists suchen...',
    loading: 'Laden...',
    spotifyUnavailable: 'Spotify API ist derzeit nicht verfügbar.',
    spotifyError: 'Spotify konnte nicht erreicht werden.',
    searchFailed: 'Suche fehlgeschlagen.',
    maxPlaylists: 'Maximum von 8 Playlists erreicht.',
    featured: 'Empfohlen',
    byOwner: 'von {{owner}} · {{count}} Tracks',
  },
  game: {
    songInProgress: 'Song läuft',
    gameStartingSoon: 'Spiel beginnt gleich',
    clickForAudio: 'Irgendwo klicken um Audio zu aktivieren',
    songOf: 'Song {{current}} von {{total}}',
    gameOver: 'Spiel vorbei!',
    finalScores: 'Endstand',
    pts: 'Pkt',
    playAgain: 'Nochmal spielen',
    songsPlayed: 'Gespielte Songs',
  },
  chat: {
    waitingForSong: 'Warte auf nächsten Song...',
    typeGuess: 'Tipp eingeben...',
    song: 'Song',
    isClose: 'ist nah dran!',
    guessedSuffix: 'hat {{label}} erraten!',
    labels: {
      title: 'den Titel',
      artist: 'den Künstler',
      year: 'das Jahr',
      artist_title: 'Titel & Künstler',
      title_year: 'Titel & Jahr',
      artist_year: 'Künstler & Jahr',
      artist_title_year: 'Titel, Künstler & Jahr',
    },
  },
  scoreboard: {
    title: 'Bestenliste',
    noScores: 'Noch keine Punkte',
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'sd_lang',
      caches: ['localStorage'],
    },
  }).then(() => {
    document.documentElement.lang = i18n.language;
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
