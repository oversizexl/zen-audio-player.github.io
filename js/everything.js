/* global gtag, URI, DOMPurify, getSearchResults, getAutocompleteSuggestions, parseYoutubeVideoID, getYouTubeVideoDescription, Plyr */

var keyCodes = {
    SPACEBAR: 32,
    ENTER: 13
};

var timeIntervals = {
    SECONDS: 60
};

/**
 * YouTube iframe API required setup
 */
var plyrPlayer;
var youTubeDataApiKey = "AIzaSyCxVxsC5k46b8I-CLXlF3cZHjpiqP_myVk";
var currentVideoID;

// global playlist, this is populated with an ajax call
var tags = [];
var playList = new Set();
var autoplayState = false;
const MAX_TAGS = 10;

var errorMessage = {
    init: function() {},
    show: function(message) {
        $(".error-message").text("ERROR: " + message);
        $(".error-message").show();

        // Pause if we got an error
        ZenPlayer.pause();

        // When the error message is shown, also hide the player
        ZenPlayer.hide();

        // Send the error to Google Analytics
        gtag("send", "event", "error", message);
    },
    hide: function() {
        $(".error-message").text("").hide();
        ZenPlayer.show();
    }
};

var warningMessage = {
    init: function() {},
    show: function(message) {
        $(".warning-message").text("WARNING: " + message).show();

        // Send warning to Google Analytics
        gtag("send", "event", "warning", message);
    },
    hide: function() {
        $(".warning-message").text("").hide();
    }
};

function isFileProtocol() {
    return URI(window.location).protocol() === "file";
}

function isLocalDevelopment() {
    const hostname = (window.location && window.location.hostname) || "";
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function shouldSkipYouTubeDataApi() {
    const searchParams = URI(window.location).search(true);
    const forceApi = searchParams.ytApi === "1";
    if (forceApi) {
        return false;
    }
    return isFileProtocol() || isLocalDevelopment();
}

function handleYouTubeError(details) {
    if (typeof details.code === "number") {
        let message = "Got an unknown error, check the JS console.";
        let verboseMessage = message;

        // Handle the different error codes
        switch (details.code) {
            case 2:
                verboseMessage = "The request contains an invalid parameter value. For example, this error occurs if you specify a video ID that does not have 11 characters, or if the video ID contains invalid characters, such as exclamation points or asterisks.";
                message = "looks like an invalid video ID";
                break;
            case 5:
                verboseMessage = "The requested content cannot be played in an HTML5 player or another error related to the HTML5 player has occurred.";
                message = "we can't play that video here, or something is wrong with YouTube's iframe API";
                break;
            case 100:
                verboseMessage = "The video requested was not found. This error occurs when a video has been removed (for any reason) or has been marked as private.";
                message = "we can't find that video, it might be private or removed";
                break;
            case 101:
                verboseMessage = "The owner of the requested video does not allow it to be played in embedded players.";
                message = "the video owner won't allow us to play that video";
                break;
            case 150:
                verboseMessage = "This error is the same as 101. It's just a 101 error in disguise!";
                message = "the video owner won't allow us to play that video";
                break;
        }

        // Update the UI w/ error
        errorMessage.show(message);
        gtag("send", "event", "YouTube iframe API error", verboseMessage);

        // Log debug info
        console.log("Verbose debug error message: ", verboseMessage);
    }
}

function getPlayerDuration() {
    if (plyrPlayer && typeof plyrPlayer.duration === "number" && !isNaN(plyrPlayer.duration)) {
        return plyrPlayer.duration;
    }

    return 0;
}

function getPlayerCurrentTime() {
    if (plyrPlayer && typeof plyrPlayer.currentTime === "number" && !isNaN(plyrPlayer.currentTime)) {
        return plyrPlayer.currentTime;
    }

    return 0;
}

function seekPlayerTo(seconds) {
    if (!plyrPlayer || typeof seconds !== "number" || isNaN(seconds)) {
        return;
    }

    if (typeof plyrPlayer.currentTime === "number") {
        plyrPlayer.currentTime = seconds;
    }
}

function getPlayerVideoData() {
    return {
        title: ZenPlayer.videoTitle || currentVideoID || "",
        author: ZenPlayer.videoAuthor || ""
    };
}

function getPlayerVideoUrl() {
    if (currentVideoID) {
        return "https://www.youtube.com/watch?v=" + currentVideoID;
    }

    return "https://www.youtube.com";
}

function fetchOEmbedVideoTitle(videoID, onSuccess) {
    if (!videoID || typeof onSuccess !== "function") {
        return;
    }

    $.ajax({
        url: "https://www.youtube.com/oembed",
        dataType: "json",
        data: {
            url: "https://www.youtube.com/watch?v=" + videoID,
            format: "json"
        },
        success: function(data) {
            if (data && data.title && data.title.trim().length > 0) {
                onSuccess(data.title);
            }
        }
    }).fail(function() {
        // Best effort only; keep current title fallback when this fails.
    });
}

// One day, try to move all globals under the ZenPlayer object
var ZenPlayer = {
    updated: false,
    isPlaying: false,
    isRepeat: false,

    init: function() {
        // Inject svg with control icons
        $(".plyr-svg").load("https://unpkg.com/plyr@3.8.4/dist/plyr.svg");

        const playerEl = document.querySelector(".plyr");
        if (playerEl) {
            playerEl.disablePictureInPicture = true;
        }

        plyrPlayer = new Plyr(playerEl, {
            autoplay: true,
            controls: ["play", "progress", "current-time", "duration", "mute", "volume"],
            hideControls: false,
            pip: false
        });

        // Set source immediately after creating the player when we have a video id
        if (currentVideoID) {
            plyrPlayer.source = {
                type: "video",
                title: "Title",
                sources: [{
                    src: currentVideoID,
                    provider: "youtube"
                }]
            };
        }

        const that = this;

        plyrPlayer.on("error", function(event) {
            if (event && event.detail && typeof event.detail.code === "number") {
                handleYouTubeError(event.detail);
                ZenPlayer.hide();
                return;
            }

            errorMessage.show("we couldn't start playback. Please try another video or reload the page.");
            console.log("Plyr error event details:", event && event.detail ? event.detail : event);
            ZenPlayer.hide();
        });

        plyrPlayer.on("ready", function() {
            // Noop if we have nothing to play
            if (!currentVideoID || currentVideoID.length === 0) {
                return;
            }

            // Gather video info
            that.videoTitle = currentVideoID;
            that.videoAuthor = "";
            that.videoDuration = getPlayerDuration();
            that.videoDescription = that.getVideoDescription(currentVideoID);
            that.videoUrl = getPlayerVideoUrl();

            // Updates the time position by a given argument in URL
            // I.e. https://zenplayer.audio/?v=koJv-j1usoI&t=30 starts at 0:30
            const t = getCurrentTimePosition();
            if (t) {
                that.videoPosition = t;
                window.sessionStorage[currentVideoID] = t;
            }

            // Initialize UI
            that.setupTitle();
            that.setupVideoDescription(currentVideoID);
            that.setupPlyrToggle();
            that.setupAutoplayToggle();

            fetchOEmbedVideoTitle(currentVideoID, function(title) {
                that.videoTitle = title;
                that.setupTitle();
            });
        });

        plyrPlayer.on("playing", function() {
            if (that.updated) {
                return;
            }

            const videoDuration = getPlayerDuration();
            // Start video from where we left off, if it makes sense
            if (window.sessionStorage && currentVideoID in window.sessionStorage) {
                const resumeTime = window.sessionStorage[currentVideoID];
                if (!isNaN(resumeTime) && videoDuration > 0 && resumeTime < videoDuration - 3) {
                    seekPlayerTo(resumeTime);
                }
            }

            that.updated = true;

            // Analytics
            gtag("send", "event", "Playing YouTube video title", that.videoTitle);
            gtag("send", "event", "Playing YouTube video author", that.videoAuthor);
            gtag("send", "event", "Playing YouTube video duration (seconds)", that.videoDuration);

            // Show player
            that.show();
            updateTweetMessage();
        });

        // when player has finished playing
        plyrPlayer.on("ended", function() {
            if (that.isRepeat) {
                seekPlayerTo(0);
                ZenPlayer.play();
                return;
            }

            if (autoplayState) {
                if (playList.length === 0 || playList.size === 0) {
                    fetchSuggestedVideoIds();
                }
                const newId = getNewVideoID();
                that.playNext(newId);
            }
        });

        plyrPlayer.on("timeupdate", function() {
            // Nothing is playing
            if (!plyrPlayer) {
                return;
            }

            // Store the current time of the video.
            let resumeTime = 0;
            const videoDuration = getPlayerDuration();
            if (window.sessionStorage && videoDuration > 0) {
                const currentTime = getPlayerCurrentTime();
                /**
                 * Only store the current time if the video isn't done
                 * playing yet. If the video finished already, then it
                 * should start off at the beginning next time.
                 * There is a fuzzy 3 seconds because sometimes the video
                 * will end a few seconds before the video duration.
                 */
                if (currentTime < videoDuration - 3) {
                    resumeTime = currentTime;
                }
                // check time and if isRepeat == true
                if (currentTime >= videoDuration && that.isRepeat) {
                    resumeTime = 0;
                    seekPlayerTo(resumeTime);
                    ZenPlayer.play();
                }
                window.sessionStorage[currentVideoID] = resumeTime;
            }
            let updatedUrl = that.videoUrl;
            if (resumeTime > 0) {
                updatedUrl = that.videoUrl + "&t=" + Math.round(resumeTime);
                $(".video-title").attr("href", updatedUrl);
            }
            else if (resumeTime <= 0 && $(".video-title").attr("href") !== that.videoUrl) {
                updatedUrl = that.videoUrl;
            }
            $(".video-title").attr("href", updatedUrl);
        });

        plyrPlayer.on("playing", function() {
            that.isPlaying = true;
        });

        plyrPlayer.on("pause", function() {
            that.isPlaying = false;
        });
    },
    // play next song from autoplay
    playNext: function(videoID) {
        $(".search-input").val(videoID);
        $(".search-form").submit();
    },
    show: function() {
        $(".audio-player").show();
        // Hide the demo link as some video is playing
        $(".demo-button").hide();
    },
    hide: function() {
        $(".audio-player").hide();
        // Show the demo link as no video is playing
        $(".demo-button").show();
    },
    setupTitle: function() {
        // Prepend music note only if title does not already begin with one.
        let tmpVideoTitle = this.videoTitle;
        if (!/^[\u2669\u266A\u266B\u266C\u266D\u266E\u266F]/.test(tmpVideoTitle)) {
            tmpVideoTitle = "<i class=\"fa fa-music\"></i> " + tmpVideoTitle;
        }
        $(".video-title").html(DOMPurify.sanitize(tmpVideoTitle));
        $(".video-title").attr("href", this.videoUrl);
    },
    setupVideoDescription: function(videoID) {
        let description = anchorURLs(this.videoDescription);
        description = anchorTimestamps(description, videoID);
        $(".video-description").html(DOMPurify.sanitize(description));
        $(".video-description").hide();

        $(".toggle-description-btn").click(function(event) {
            toggleElement(event, ".video-description", "Description");
        });
    },
    setupPlyrToggle: function() {
        // Show player button click event
        $(".toggle-player-btn").off("click").on("click", function(event) {
            toggleElement(event, ".plyr__video-wrapper", "Player");
        });
    },
    setupAutoplayToggle: function() {
        // toggle auto next song playing
        $(".toggle-autoplay-btn").click(function(event) {
            const toggleTextElement = $(event.currentTarget);
            toggleTextElement.toggleClass("toggle-autoplay-active");
            const active = toggleTextElement.hasClass("toggle-autoplay-active");
            if (active) {
                toggleTextElement.html("&#10004; Autoplay");
                autoplayState = true;
                window.sessionStorage.setItem("autoPlay", true);
            }
            else {
                toggleTextElement.html("Autoplay");
                autoplayState = false;
                window.sessionStorage.removeItem("autoPlay");
                window.sessionStorage.removeItem("playList");
            }
        });
    },

    getVideoDescription: function(videoID) {
        let description = "";

        if (shouldSkipYouTubeDataApi()) {
            console.log("Skipping video description request as we're running the site locally.");
            $(".toggle-description-btn").hide();
        }
        else {
            getYouTubeVideoDescription(
                videoID,
                youTubeDataApiKey,
                function(data) {
                    if (data.items.length === 0) {
                        errorMessage.show("Video description not found");
                    }
                    else {
                        description = data.items[0].snippet.description;
                        tags = data.items[0].snippet.tags;
                    }
                },
                function(jqXHR, textStatus, errorThrown) {
                    logError(jqXHR, textStatus, errorThrown, "Video Description error");
                }
            );
        }

        // If there's no description to show, don't pretend there is
        if (description.trim().length === 0) {
            $(".toggle-description-btn").hide();
        }

        return description;
    },
    play: function() {
        if (plyrPlayer && typeof plyrPlayer.play === "function") {
            plyrPlayer.play();
        }
    },
    pause: function() {
        if (plyrPlayer && typeof plyrPlayer.pause === "function") {
            plyrPlayer.pause();
        }
    }
};

/**
 * Create a twitter message with current song if we have one.
 */
function updateTweetMessage() {
    const url = URI("https://zen-audio-player.github.io");

    const opts = {
        text: "Listen to YouTube videos without the distracting visuals",
        hashTags: "ZenAudioPlayer",
        url: url.toString()
    };

    const id = getCurrentVideoID();
    if (id) {
        url.setSearch("v", id);
        opts.url = url.toString();
        opts.text = "I'm listening to " + getPlayerVideoData().title;
    }

    twttr.widgets.createHashtagButton(
        "ZenAudioPlayer",
        document.querySelector(".tweet-button"),
        opts
    );
}

function logError(jqXHR, textStatus, errorThrown, _errorMessage) {
    const responseText = JSON.parse(jqXHR.error().responseText);
    errorMessage.show(responseText.error.errors[0].message);
    console.log(_errorMessage, errorThrown);
}

function toggleElement(event, selector, buttonText) {
    event.preventDefault();

    const targetElement = $(selector);
    if (!targetElement.length) {
        return;
    }
    const toggleTextElement = $(event.currentTarget);
    targetElement.toggle("fast", function() {
        toggleTextElement.text((targetElement.is(":visible") ? "Hide " : "Show ") + buttonText);
    });
}

/**
 * wrapParseYouTubeVideoID the first v query value.
 * Will return null if there's no v query param
 * @return {string|null}
 */
function getCurrentVideoID() {
    const v = URI(window.location).search(true).v;

    // If the URL has multiple v parameters, take parsing the last one (usually when ?v=someurl&v=xyz)
    let r;
    if (Array.isArray(v)) {
        r = wrapParseYouTubeVideoID(v.pop());
    }
    else if (v) {
        r = wrapParseYouTubeVideoID(v);
    }
    return r;
}

/**
 * Return the current times position, provided by the t query param, parsed to seconds.
 * @returns {Number}
 */
function getCurrentTimePosition() {
    const t = parseInt(URI(window.location).search(true).t, 10);
    const timeContinue = parseInt(URI(window.location).search(true).time_continue, 10);
    if (t > 0 && t < Number.MAX_VALUE) {
        return t;
    }
    else if (timeContinue > 0 && timeContinue < Number.MAX_VALUE) {
        return timeContinue;
    }
    return 0;
}

/**
 * Return the q query param if one exists.
 * @returns {string|bool|null}
 */
function getCurrentSearchQuery() {
    return URI(window.location).search(true).q;
}

/**
 * Remove any search params or fragments from a URL.
 * @param url
 * @returns {string} The stripped URL
 */
function cleanURL(url) {
    return URI(url).search("").fragment("");
}

/**
 * Return the current URL, appending v=videoID and t=videoPosition, if set.
 * Remove hashes from the URL.
 * @param {string} videoID
 * @param {number} [videoPosition]
 * @returns {string}
 */
function makeListenURL(videoID, videoPosition) {
    const url = cleanURL(window.location);
    url.setSearch("v", videoID);
    if (videoPosition) {
        url.setSearch("t", videoPosition);
    }
    return url.toString();
}

/**
 * Return the current url with the Q query param set to the searchQuery.
 * Strip any hashes from the URL.
 * @param {string} searchQuery
 * @returns {string}
 */
function makeSearchURL(searchQuery) {
    return cleanURL(window.location).setSearch("q", searchQuery).toString();
}

function anchorURLs(text) {
    /* RegEx to match http or https addresses
    * This will currently only match TLD of two or three letters
    * Ends capture when:
    *    (1) it encounters a TLD
    *    (2) it encounters a period (.) or whitespace, if the TLD was followed by a forwardslash (/) */
    const re = /((?:http|https)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}(?:\/\S*[^\.\s])?)/g; // eslint-disable-line no-useless-escape
    /* Wraps all found URLs in <a> tags, do not encode display text */
    return text.replace(re, function(u) {
        const uEncoded = encodeURI(u);
        return `<a href="${uEncoded}" target="_blank">${u}</a>`;
    });
}

function anchorTimestamps(text, videoID) {
    /* RegEx to match
      hh:mm:ss
      h:mm:ss
      mm:ss
      m:ss
    and wraps the timestamps in <a> tags
    RegEx explanation:
    ((?:[0-5]\d|\d|) either the string is "colon 00-59" or "0-9" or "blank"
    (?:\d|\:[0-5]\d) either the string is "colon 0-9" or "colon 00-59"
    (?:$|\:[0-5]\d)) either the string ends or is a a number between 00-59
    */
    const re = /((?:[0-5]\d|\d|)(?:\d|\:[0-5]\d)(?:$|\:[0-5]\d))/g; // eslint-disable-line no-useless-escape
    return text.replace(re, function(match) {
        return "<a href=\"" + makeListenURL(videoID, convertTimestamp(match)) + "\">" + match + "</a>";
    });
}

function convertTimestamp(timestamp) {
    let seconds;
    let minutes;
    let hours;
    const timeComponents = timestamp.split(":");
    if (timeComponents.length === 3) {
        hours = convertHoursToSeconds(timeComponents[0]);
        minutes = convertMinutesToSeconds(timeComponents[1]);
        seconds = parseBase10Int(timeComponents[2]);
    }
    else {
        hours = 0;
        minutes = convertMinutesToSeconds(timeComponents[0]);
        seconds = parseBase10Int(timeComponents[1]);
    }
    return hours + minutes + seconds;
}

function convertHoursToSeconds(hours) {
    return parseBase10Int(hours) * timeIntervals.SECONDS * timeIntervals.SECONDS;
}

function convertMinutesToSeconds(minutes) {
    return parseBase10Int(minutes) * timeIntervals.SECONDS;
}

function parseBase10Int(value) {
    return parseInt(value, 10);
}

function wrapParseYouTubeVideoID(url) {
    if (currentVideoID && url === currentVideoID) {
        // We have already determined the video id
        return currentVideoID;
    }

    const info = parseYoutubeVideoID(url);
    if (info.id) {
        currentVideoID = info.id;
        gtag("send", "event", "video ID format", info.format);
        return info.id;
    }
    else {
        errorMessage.show("Failed to parse the video ID.");
    }
}

// The focus video ID
var focusId = "pJ5FD9_Orbg";
// The lofi video ID
var lofiId = "i43tkaTXtwI";

// Some demo video's audio, feel free to add more
var demos = [
    "koJv-j1usoI", // The Glitch Mob - Starve the Ego, Feed the Soul
    "EBerFisqduk", // Cazzette - Together (Lost Kings Remix)
    "jxKjOOR9sPU", // The Temper Trap - Sweet Disposition
    "03O2yKUgrKw"  // Mike Mago & Dragonette - Outlines
];

function pickDemo() {
    return demos[Math.floor(Math.random() * demos.length)];
}

function updateAutoplayToggle(state) {
    const toggleElement = $(".toggle-autoplay-btn");
    if (state) {
        toggleElement.addClass("toggle-autoplay-active");
        toggleElement.html("&#10004; Autoplay");
    }
    else {
        toggleElement.removeClass("toggle-autoplay-active");
        toggleElement.html("Autoplay");
    }
}

function getNewVideoID() {
    let nextID = playList.pop();
    while (currentVideoID === nextID) {
        nextID = playList.pop();
    }
    window.sessionStorage.setItem("playList", JSON.stringify(playList));
    return nextID;
}

function fetchSuggestedVideoIds() {
    if ((playList.length === 0 || playList.size === 0) && tags.length && !shouldSkipYouTubeDataApi()) {
        for (let index = 0; index < tags.length && index < MAX_TAGS; index++) {
            // get similar videos, populate playList
            $.ajax({
                url: "https://www.googleapis.com/youtube/v3/search",
                dataType: "json",
                async: false,
                data: {
                    key: youTubeDataApiKey,
                    part: "snippet",
                    type: "video",
                    order: "relevance",
                    q: tags[index],
                    maxResults: 2
                },
                success: onRelatedVideoFetchSuccess
            }).fail(function(jqXHR, textStatus, errorThrown) {
                logError(jqXHR, textStatus, errorThrown, "Related video lookup error");
            });
        }
        playList = Array.from(playList);
        window.sessionStorage.setItem("playList", JSON.stringify(playList))
    }
}

function onRelatedVideoFetchSuccess(data) {
    // push items into playlist
    for (let i = 0; i < data.items.length; i++) {
        playList.add(data.items[i].id.videoId);
    }
}

function loadAutoPlayDetails() {
    // load playList from session storage on reload
    if (window.sessionStorage.getItem("playList")) {
        playList = JSON.parse(window.sessionStorage.getItem("playList"));
    }

    // fetch autoPlay from session storage on reload
    if (window.sessionStorage.getItem("autoPlay")) {
        autoplayState = window.sessionStorage.getItem("autoPlay");
        updateAutoplayToggle(autoplayState);
    }
}

function resetAutoPlayList() {
    playList = new Set();
    tags = [];
    window.sessionStorage.removeItem("playList");
}

$(function() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        $("main").hide();
        $(".mobile-message").html("Sorry, we don't support mobile devices.");
        $(".mobile-message").show();
        return;
    }

    errorMessage.init();
    warningMessage.init();

    if (shouldSkipYouTubeDataApi()) {
        warningMessage.show("YouTube Data API features are disabled on localhost to preserve quota. Paste a video URL or ID to play directly.");
    }

    loadAutoPlayDetails();

    // How do we know if the value is truly invalid?
    // Preload the form from the URL
    const currentVideoID = getCurrentVideoID();
    if (currentVideoID) {
        $(".search-input").attr("value", currentVideoID);
    }
    else {
        const currentSearchQuery = getCurrentSearchQuery();
        if (currentSearchQuery) {
            $(".search-input").attr("value", currentSearchQuery);
            if (shouldSkipYouTubeDataApi()) {
                warningMessage.show("Search is disabled on localhost to preserve YouTube API quota. Paste a video URL or ID to play directly.");
            }
            else {
                getSearchResults(
                    currentSearchQuery,
                    youTubeDataApiKey,
                    function(data) {
                        if (data.pageInfo.totalResults === 0) {
                            errorMessage.show("No results.");
                            return;
                        }
                        $(".search-results").show();
                        // Clear out results
                        $(".search-results ul").html("");

                        const start = "<li><h4><a href=?v=";
                        $.each(data.items, function(index, result) {
                            $(".search-results ul").append(start + result.id.videoId + ">" + result.snippet.title + "</a></h4><a href=?v=" + result.id.videoId + "><img src=" + result.snippet.thumbnails.medium.url + " alt='" + result.snippet.title + "'></a></li>");
                        });
                    },
                    function(jqXHR, textStatus, errorThrown) {
                        logError(jqXHR, textStatus, errorThrown, "Search error");
                    }
                );
            }
        }
    }

    // Autocomplete with youtube suggested queries
    if (!shouldSkipYouTubeDataApi()) {
        $(".search-input").typeahead({
            hint: false,
            highlight: true,
            minLength: 1
        }, {
            source: function (query, processSync, processAsync) {
                getAutocompleteSuggestions(query, function(data) {
                    return processAsync($.map(data[1], function(item) {
                        return item[0];
                    }));
                });
            }
        }).bind("typeahead:selected", function(obj, datum) {
            window.location.href = makeSearchURL(datum);
        });
    }

    // Handle form submission
    $(".search-form").submit(function(event) {
        event.preventDefault();
        let formValue = $.trim($(".search-input").val());
        let formValueTime = /[?&](t|time_continue)=(\d+)/g.exec(formValue);
        if (formValueTime && formValueTime.length > 2) {
            formValue = formValue.replace(formValueTime[0], "");
            formValueTime = parseInt(formValueTime[2], 10);
        }
        if (formValue) {
            const videoID = wrapParseYouTubeVideoID(formValue, true);
            gtag("send", "event", "form submitted", videoID);
            if (shouldSkipYouTubeDataApi()) {
                warningMessage.show("Skipping video lookup request while running locally.");
                window.location.href = makeListenURL(videoID, formValueTime);
            }
            else {
                $.ajax({
                    url: "https://www.googleapis.com/youtube/v3/videos",
                    dataType: "json",
                    async: false,
                    data: {
                        key: youTubeDataApiKey,
                        part: "snippet",
                        id: videoID
                    },
                    success: function(data) {
                        if (data.items.length === 0) {
                            window.location.href = makeSearchURL(formValue);
                        }
                        else {
                            tags = data.items[0].snippet.tags;
                            window.location.href = makeListenURL(videoID, formValueTime);
                        }
                    }
                }).fail(function(jqXHR, textStatus, errorThrown) {
                    logError(jqXHR, textStatus, errorThrown, "Lookup error");
                });
                // fetching next videoIds for auto play
                fetchSuggestedVideoIds();
            }
        }
        else {
            // Show the Focus button If there is no search
            $(".focus-btn").show();
            $(".focus-btn").css("display", "inline");
            errorMessage.show("Try entering a YouTube video ID or URL!");
        }
    });

    // Reverts to Home when there is no text in input
    $(".search-input").on("input", function() {
        if ($(".search-input").val() === "") {
            $(".search-results").hide();
        }
    });

    $(".toggle-repeat-btn").click(function() {
        $(this).toggleClass("toggle-repeat-active");
        const active = $(this).hasClass("toggle-repeat-active");
        if (active) {
            $(this).html("&#10004; Repeat Track");
        }
        else {
            $(this).html("Repeat Track");
        }
        ZenPlayer.isRepeat = $(this).hasClass("toggle-repeat-active");
    });

    // Handle demo link click
    $(".demo-button").click(function(event) {
        event.preventDefault();
        resetAutoPlayList();

        gtag("send", "event", "demo", "clicked");

        // Don't continue appending to the URL if it appears "good enough".
        // This is likely only a problem if the demo link didn't work right the first time
        const pickedDemo = pickDemo();
        if (window.location.href.indexOf(demos) === -1) {
            window.location.href = makeListenURL(pickedDemo);
        }
        else {
            gtag("send", "event", "demo", "already had video ID in URL");
        }
    });

    // Handle focus link click
    $(".focus-btn").click(function(event) {
        event.preventDefault();
        resetAutoPlayList();

        gtag("send", "event", "focus", "clicked");
        // Redirect to the favorite "focus" URL
        window.location.href = makeListenURL(focusId);
    });

    // handle click on search icon
    $(".search-submit").click(function() {
        resetAutoPlayList();
    });

    // Check if the current ID is the focus ID
    $(window).on("load", function() {
        loadAutoPlayDetails();

        // Show Focus Button
        if (window.location.href.indexOf(focusId) === -1) {
            $(".focus-btn").show();
            $(".focus-btn").css("display", "inline");
        }
        else {
            // Hide Focus Button
            $(".focus-btn").hide();
        }
    });

    // Handle lofi link click
    $(".lofi-btn").click(function(event) {
        event.preventDefault();
        gtag("send", "event", "lofi", "clicked");
        // Redirect to the favorite "lofi" URL
        window.location.href = makeListenURL(lofiId);
    });

    // Check if the current ID is the lofi ID
    $(window).on("load", function() {
        // Show Lofi Button
        if (window.location.href.indexOf(lofiId) === -1) {
            $(".lofi-btn").show();
            $(".lofi-btn").css("display", "inline");
        }
        else {
            // Hide Lofi Button
            $(".lofi-btn").hide();
        }
    });

    // Load the player
    ZenPlayer.init(currentVideoID);

    $(document).on("keyup", function(evt) {
        // Toggle play/pause if not typing in the search box
        if (evt.keyCode === keyCodes.SPACEBAR && !$(".search-input").is(":focus")) {
            evt.preventDefault();
            if (ZenPlayer.isPlaying) {
                ZenPlayer.pause();
            }
            else {
                ZenPlayer.play();
            }
        }
    });

    $(document).on("keydown", function(evt) {
        // If not typing in the search prevent "page down" scrolling
        if (evt.keyCode === keyCodes.SPACEBAR && !$(".search-input").is(":focus")) {
            evt.preventDefault();
        }

        if (evt.keyCode === keyCodes.ENTER && $(".search-input").is(":focus")) {
            resetAutoPlayList();
        }
    });
});
