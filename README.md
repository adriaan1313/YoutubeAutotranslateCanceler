# Notes exclusive to my fork

* You can expect this to be updated, but only if I got impacted by any changes. Can't fix what I can't see after all.
* If console logs say something about failing to parse URLs that look like google ads URLs, or if you see the code trying to do that while debugging, add this filter to uBlock: `www.youtube.com##a[href*="https://www.googleadservices.com"]`
* Last checked that everything still works on 24 juli 2025.

# YoutubeAutotranslateCanceler

> An API Client may provide an option to translate a video title to other languages. However, the API Client must not add any such translations without the user's consent. In addition, if the API Client's default behavior is to enable the option to translate the video title, it must clearly present to the user an easy way to disable that behavior.  
> -- From https://developers.google.com/youtube/terms/developer-policies


I was annoyed by YouTube changing video titles to poorly auto-translated versions, so I made this script using YouTube Data API to retrive original titles and change them back.

# How to use

First, you need a userscript extension, such as Tampermonkey for [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) or [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/). Next, click [here](https://github.com/pcouy/YoutubeAutotranslateCanceler/raw/master/AntiTranslate.user.js) to install the userscript.

Unfortunately, this requires an API key to work. However, requests to this API are free. 

### Instructions on how to get an API key

Detailed instructions and screenshots are provided below

##### TL;DR : 

You can browse to [Google's official support](https://developers.google.com/youtube/v3/getting-started) in order to know how to get an API key. 
Then, you need to enable Youtube Data API for this key in [Google Developers Console](https://console.developers.google.com/apis/api/youtube.googleapis.com/) and you're good to go.
When you first run the script, it prompts you for an API key until it manages to complete a successful request.


Head to [Google Developers Console](https://console.developers.google.com/) and click "Select a project" (step 1).

![Step 1](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step1.png)

* * *

Then, you need to create a new project (steps 2 and 3) which you can name as you want.

![Step 2](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step2.png)

![Step 3](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step3.png)

* * *

Once your project is created and active in your dashboard, you need to add APIs and services. To do that, just click on the link, then search for YouTube Data API (step 4) and click "enable" (step 5). 

![Step 4a](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step4a.png)
![Step 4b](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step4b.png)
![Step 4c](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step4c.png)

![Step 5](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step5new.png)

* * *

It asks you to create credentials in order to use the API, just click "create credentials" (step 6), then "Public data" in the next page. The YouTube Data API v3 should be selected by default. If not, select it. Then press next. (step 7a) You will see your API key. Copy it, you will need to paste this when the script prompts you for it. Do not share it.

![Step 6](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step6new.png "Step 6")

![Step 7a](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step7a.png)
![Step 7b](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step7b.png)

* * *

If you click on "Restrict key", it'll take you to a page where you can set restrictions on this key. It is not needed, but generally considered good practice.
If you want to set a name to identify the key, do it here (step 8-1). You can limit the key to be used from only youtube URLs (step 8-2) and only use the youtube api. (step 8-3)
Then press save.

![Step 8](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step8new.png)


* * *

If you did not copy the key in step 7, you can also find it here when you press "Show key".

![Step 10](https://github.com/adriaan1313/YoutubeAutotranslateCanceler/raw/master/howto_screenshots/step10new.png)
