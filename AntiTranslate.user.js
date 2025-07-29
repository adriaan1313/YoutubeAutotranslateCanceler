// ==UserScript==
// @name         Youtube Auto-translate Canceler
// @namespace    https://github.com/adriaan1313/YoutubeAutotranslateCanceler
// @version      0.70.4
// @description  Remove auto-translated youtube titles
// @author       Pierre Couy
// @match        https://www.youtube.com/*
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.deleteValue
// ==/UserScript==

// Configurations
// How many milliseconds between each check. Higher value means more stress on browser.
const MAIN_POLLING_INTERVAL = 1000;
// How many milliseconds between each check if description has been changed or not by method of clicking the "show more" or "show less" button. Lightweight, can set to a low value.
const DESCRIPTION_POLLING_INTERVAL = 200;

(async () => {
    'use strict';
	var useTrusted = false;
    //i am confused, but this might help?
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        window.trustedTypes.createPolicy('default', {
            createHTML: (string, sink) => string
        });
        useTrusted = true;
    }

    /*
    Get a YouTube Data v3 API key from https://console.developers.google.com/apis/library/youtube.googleapis.com?q=YoutubeData
    */
    var NO_API_KEY = false;
    var api_key_awaited = await GM.getValue("api_key");
    if (api_key_awaited === undefined || api_key_awaited === null || api_key_awaited === "") {
        await GM.setValue("api_key", prompt("Enter your API key. Go to https://developers.google.com/youtube/v3/getting-started to know how to obtain an API key, then go to https://console.developers.google.com/apis/api/youtube.googleapis.com/ in order to enable Youtube Data API for your key."));
    }

    api_key_awaited = await GM.getValue("api_key");
    if (api_key_awaited === undefined || api_key_awaited === null || api_key_awaited === "") {
        NO_API_KEY = true; // Resets after page reload, still allows local title to be replaced
        console.log("NO API KEY PRESENT");
    }
    const API_KEY = await GM.getValue("api_key");
    var API_KEY_VALID = false;

    var url_template = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id={IDs}&key=" + API_KEY;

    // Caches can grow big with long tab sessions. Not sure the real impact but refreshing a YT tab from time to time might help.
    var cachedTitles = {} // Dictionary(id, title): Cache of API fetches, survives only Youtube Autoplay
    let cachedDescriptions = new Map();

    var currentLocation; // String: Current page URL
    var changedDescription; // Bool: Changed description
    var alreadyChanged; // List(string): Links already changed
    var cachedDescription; // String: Cached description to use for updating desc when it's been changed once
    var cachedTitle; // String: Cached title to revert changes done by YT after title has already been updated
    var noDescription; // Bool: For when the video doesn't even have a description

    function getVideoID(a) {
        while (a.tagName != "A") {
            a = a.parentNode;
        }
        var href = a.href;
        if (href.includes("short")) {
            var tmp = href.split('/')[4];
        } else {
            var tmp = href.split('v=')[1];
        }
        return tmp.split('&')[0];
    }

    function getVideoLink(a) {
        while (a.tagName != "A") {
            a = a.parentNode;
        }
        return a.href;
    }

    function resetChanged() {
        console.log(" --- Page Change detected! --- ");
        currentLocation = document.title;
        changedDescription = false;
        noDescription = false;
        alreadyChanged = [];
    }
    resetChanged();

    function changeTitles() {
        if (currentLocation !== document.title) resetChanged();

        if (NO_API_KEY) {
            return;
        }

        var APIcallIDs;

        // REFERENCED VIDEO TITLES - find video link elements in the page that have not yet been changed
        var links = Array.prototype.slice.call(document.getElementsByTagName("a")).filter(a => {
            const bounds = a.getBoundingClientRect();
            return (a.id == 'video-title-link' || a.id == 'video-title' || a.classList.contains("yt-lockup-metadata-view-model-wiz__title")) &&
                !a.classList.contains("ytd-video-preview") &&
                !(a.href.includes("list=") && !(a.classList.contains("ytd-playlist-video-renderer") || a.classList.contains("ytd-playlist-panel-video-renderer"))) &&
                !a.href.includes("/clip/") && bounds.width > 0 && bounds.height > 0 &&
                alreadyChanged.indexOf(a) == -1;
        });

        var spans = Array.prototype.slice.call(document.getElementsByTagName("span")).filter(a => {
            const bounds = a.getBoundingClientRect();
            return (a.id == 'video-title' || a.classList.contains("ytp-videowall-still-info-title")) &&
                !(getVideoLink(a).includes("list=") || getVideoLink(a).includes("/clip/") || a.classList.contains("ytd-radio-renderer") || a.classList.contains("ytd-playlist-renderer" )) &&
                bounds.width > 0 && bounds.height > 0 &&
                alreadyChanged.indexOf(a) == -1;
        });
        //i know there is only supposed to be 1 element per id, but youtube doesn't
        // REFERENCED VIDEO DESCRIPTIONS - idk why we are shouting
        const descriptions = [...document.querySelectorAll("#description-text")].filter(a => {
            const bounds = a.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0 &&
                alreadyChanged.indexOf(a) == -1 &&
                !a.attributes["is-empty"];
        });

        links = links.concat(spans).slice(0, 30);

        // MAIN VIDEO DESCRIPTION - request to load original video description
        var mainVidID = "";
        if (!changedDescription && window.location.href.includes("/watch")) {
            mainVidID = window.location.href.split('v=')[1].split('&')[0];
            cachedDescription = "";
        }

        if (mainVidID != "" || links.length > 0) { // Initiate API request

            console.log("Checking " + (mainVidID != "" ? "main video and " : "") + links.length + " video titles!");

            // Get all videoIDs to put in the API request
            var IDs = links.map(a => getVideoID(a));
            var APIFetchIDs = IDs.filter(id => cachedTitles[id] === undefined);
            if(APIFetchIDs.length == 0 && mainVidID == "") {
                //console.log("somehow, we have selected " + IDs.join(", ") + ", but already have the data for it?");
                //somehow either we or yt fucked up, doesn't really matter as we fix it here
                fixTextForLinks(links);
                fixTextForDescriptions(descriptions);
                return;
            }
            var requestUrl = url_template.replace("{IDs}", (mainVidID != "" ? (mainVidID + ",") : "") + APIFetchIDs.join(','));

            // Issue API request
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) { // Success

                    links;IDs; //we do not want it to collect this garbage yet as we are debugging

                    var data = JSON.parse(xhr.responseText);

                    if (data.kind == "youtube#videoListResponse") {
                        API_KEY_VALID = true;

                        data = data.items;

                        if (mainVidID != "") {
                            replaceVideoDesc(data);
                        }

                        // Create dictionary for all IDs and their original titles
                        data.forEach(v => {
                            cachedTitles[v.id] = v.snippet.title;
                            cachedDescriptions.set(v.id, v.snippet.description);
                        });

                        fixTextForLinks(links);
                        fixTextForDescriptions(descriptions);

                    } else {
                        console.log("API Request Failed!");
                        console.log(requestUrl);
                        console.log(data);

                        // This ensures that occasional fails don't stall the script
                        // But if the first query is a fail then it won't try repeatedly
                        NO_API_KEY = !API_KEY_VALID;
                        if (NO_API_KEY) {
                            GM_setValue('api_key', '');
                            console.log("API Key Fail! Please Reload!");
                        }
                    }
                }
            };
            xhr.open('GET', requestUrl);
            xhr.send();

        }

        if (mainVidID == "" && changedDescription) {
            var pageTitle = document.querySelector("h1.style-scope > yt-formatted-string");
            if (pageTitle.attributes["is-empty"] != undefined) {
                pageTitle.removeAttribute("is-empty");
            }
            if (pageTitle.innerText.length != cachedTitle.length) {
                pageTitle.innerText = cachedTitle;
            }
        }
    }

    function fixTextForLinks(links){
        for(const link of links){
            let innerElement;
            if(link.classList.contains("ytd-playlist-panel-video-renderer")) {
                innerElement = link.querySelector("#video-title");//specifically for watch pages where the current video is in a playlist
            } else {
                innerElement = link.querySelector("yt-formatted-string, span");
            }
            const originalTitle = cachedTitles[getVideoID(link)].trim();
            let pageTitle = link.innerText.trim();
            if(innerElement){
                pageTitle = innerElement.innerText.trim();
            }
            if(pageTitle == "My Mix") console.log("either someone called their video 'My Mix' or we messed up");

            if (pageTitle.replace(/\s{2,}/g, ' ') != originalTitle.replace(/\s{2,}/g, ' ')) {
                console.log("'" + pageTitle + "' --> '" + originalTitle + "'");
                if (innerElement) {
                    innerElement.innerText = originalTitle;
                } else {
                    //on the channel page or subscriptions, it is an a with directly in it the text?
                    link.innerText = originalTitle;
                }
            }
            alreadyChanged.push(link);
            if(innerElement){
                alreadyChanged.push(innerElement);//also add the inner element in case it would be selected as one of tha spans
            }

        }
    }
    function fixTextForDescriptions(descriptions){
        for(const description of descriptions){
            const id = description.parentElement.querySelector("a").href.split("v=")[1].split("&")[0];
            if(cachedDescriptions.has(id)){
                const originalDescription = cachedDescriptions.get(id).trim();
                let pageDescription = description.innerText.trim();
                if (pageDescription.replace(/\s{2,}/g, ' ') != originalDescription.replace(/\s{2,}/g, ' ')) {
                    //we do not log this, as they are cut to a certain length, and we replace all descriptions, always. Also, they are just very long.
                    description.innerText = originalDescription;
                }
                alreadyChanged.push(description);
            }
            //else do nothing, should be processed when the data gets received in changeTitles (when there are more than 30 on a page)
        }
    }

    function linkify(inputText) {
        var replacedText, replacePattern1, replacePattern2, replacePattern3;

        //URLs starting with http://, https://, or ftp://
        replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
        replacedText = inputText.replace(replacePattern1, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="$1">$1</a>');


        //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
        replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
        replacedText = replacedText.replace(replacePattern2, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="http://$1">$1</a>');

        //Change email addresses to mailto:: links.
        replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
        replacedText = replacedText.replace(replacePattern3, '<a class="yt-simple-endpoint style-scope yt-formatted-string" spellcheck="false" href="mailto:$1">$1</a>');

        return replacedText;
    }

    function replaceVideoDesc(data) {
        var pageDescriptionSmall = document.querySelector("#snippet yt-attributed-string > span");
        var pageDescription = document.querySelector("#expanded yt-attributed-string > span");
        if(pageDescription == null && pageDescriptionSmall == null){
            if(document.querySelector("#description-placeholder") && !document.querySelector("#description-placeholder").hidden){
                console.log("Oh, the video doesn't even have a description!");
                changedDescription = true;//this is kind of a lie, but does what we want it to, kind of
                noDescription = true;
                return;
            }
            console.log("Failed to find main video description on page!");
        }
        var videoDescription = data[0].snippet.description;
        var pageTitle = document.querySelector("h1.style-scope > yt-formatted-string");
        let fullscreenTitle = document.querySelector(".ytp-title-link");
        if (videoDescription != null) {
            // linkify replaces links correctly, but without redirect or other specific youtube stuff (no problem if missing)
            // Still critical, since it replaces ALL descriptions, even if it was not translated in the first place (no easy comparision possible)
            cachedDescription = linkify(videoDescription);
            if(pageDescription != null){
                if(useTrusted){
                    pageDescription.innerHTML = window.trustedTypes.defaultPolicy.createHTML(cachedDescription);
                } else {
                    pageDescription.innerHTML = cachedDescription;
                }
                pageDescription.attributes["changed"] = true;
            }
            if(pageDescriptionSmall != null){
                if(useTrusted){
                    pageDescriptionSmall.innerHTML = window.trustedTypes.defaultPolicy.createHTML(cachedDescription);
                } else {
                    pageDescriptionSmall.innerHTML = cachedDescription;
                }
                pageDescriptionSmall.attributes["changed"] = true;
            }
            console.log("Reverting main video title '" + pageTitle.innerText + "' to '" + data[0].snippet.title + "'");
            cachedTitle = data[0].snippet.title;
            pageTitle.innerText = cachedTitle;
            fullscreenTitle.innerText = cachedTitle;
            // Just force a title update, screw youtube's title refresh logic
            pageTitle.removeAttribute("is-empty");
            document.title = data[0].snippet.title + " - Youtube";
            currentLocation = document.title;
            console.log("Reverting main video description!");
            changedDescription = true;
        } else {
            console.log("Failed to find main video description!");
        }
    }

    // Youtube fucked the description layout up by force reloading it when you click on the "show more" or "show less" button
    // So this is the workaround. Ideally injecting directly the object that contains the decsription or modifying the behavior of these buttons is better.
    // Run separately from changeTitles() to be more responsive. Hopefully won't cause race condition. Shouldn't, but might.
    function replaceVideoDescCached() {
        if (!changedDescription || noDescription) {
            return;
        }
        var pageDescription = document.querySelector("#expanded yt-attributed-string > span");
        if (pageDescription != null && pageDescription.attributes["changed"] == undefined) {
            pageDescription.attributes["changed"] = true;
            if(useTrusted){
                pageDescription.innerHTML = window.trustedTypes.defaultPolicy.createHTML(cachedDescription);
            } else {
                pageDescription.innerHTML = cachedDescription;
            }
        }
        var pageDescriptionSmall = document.querySelector("#snippet yt-attributed-string > span");
        if (pageDescriptionSmall != null && pageDescriptionSmall.attributes["changed"] == undefined) {
            pageDescriptionSmall.attributes["changed"] = true;
            if(useTrusted){
                pageDescriptionSmall.innerHTML = window.trustedTypes.defaultPolicy.createHTML(cachedDescription);
            } else {
                pageDescriptionSmall.innerHTML = cachedDescription;
            }
        }
    }

    // Execute every seconds in case new content has been added to the page
    // DOM listener would be good if it was not for the fact that Youtube changes its DOM frequently
    setInterval(changeTitles, MAIN_POLLING_INTERVAL);
    setInterval(replaceVideoDescCached, DESCRIPTION_POLLING_INTERVAL);
})();
