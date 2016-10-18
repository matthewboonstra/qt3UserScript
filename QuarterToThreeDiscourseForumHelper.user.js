// ==UserScript==
// @name         QuarterToThree Discourse Forum Helper
// @namespace    https://github.com/matthewboonstra/qt3UserScript/
// @version      0.35.1
// @description  A User Script for the new QuarterToThree forum on Discourse.
// @author       arrendek
// @match        *://forum.quartertothree.com/*
// @grant        none
// @downloadURL  https://github.com/matthewboonstra/qt3UserScript/raw/master/QuarterToThreeDiscourseForumHelper.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    //var scriptCssUrl = "https://cdn.rawgit.com/matthewboonstra/qt3UserScript/master/qt3Script.css";
    // specific commit version for new css change
    var scriptCssUrl = "https://cdn.rawgit.com/matthewboonstra/qt3UserScript/e21f7507095350654ee94fb0b9341e4dfe55fb6a/qt3Script.css";
    
    // iframe tracker for youtube embeds
    var iframeTrackingUrl = "https://cdn.rawgit.com/vincepare/iframeTracker-jquery/56960ccf4bc600754348832e7e5fdc092e562d35/jquery.iframetracker.js";
    
    var trackedIframes = [];
    
    var normalThemeCss = "";
    var nightThemeCss = "https://cdn.rawgit.com/matthewboonstra/qt3UserScript/master/qt3NightTheme.css";
    var themeCssList = [normalThemeCss, nightThemeCss];
    
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    var username;
    var mutedUsernames;
    var userJsonURL;
    var customCss;
    var enableConsoleOutput = false;
    var customCssFieldNum = 10;
    
    var lastWindowHref;
    
    var usercardObserver, postsObserver, mainOutletObserver;
    
    var jQMuteBtn;
    
    function gotUserJson(data)
    {
        mutedUsernames = data.user.muted_usernames;
        // detect earlier saved theme and update to correct field
        if (data.user.user_fields[9] && data.user.user_fields[9].indexOf && data.user.user_fields[9].indexOf(".css")>0)
        {
            customCss = data.user.user_fields[9];
            logToConsole("erasing custom css from twitch field and resaving to correct field ",true);
            var customCssDataObj = {user_fields: {9: ""}};
            customCssDataObj.user_fields[customCssFieldNum] = customCss;
            $.ajax({
                data: customCssDataObj,
                url: userJsonURL,
                method: "put"
            }).done(function() {location.reload();});
        }
        else {
            customCss = data.user.user_fields[customCssFieldNum];
        }
        $(document).trigger("qt3script:gotMutedUserNames");
        $(document).trigger("qt3script:gotCustomCss");
    }
    
    function loadCustomCss()
    {
        if (customCss)
        {
            $('head').append('<link rel="stylesheet" href="'+customCss+'" type="text/css" />');
            /*if ($("#qt3script-theme-select").length>0)
            {
                var customCssListIndex = $.inArray(customCss,themeCssList);
                if (customCssListIndex>=0) {
                    $("#qt3script-theme-select").select2("val",customCssListIndex);
                }
            }*/
        }
    }
    
    function revealHiddenPost()
    {
        var jQObj = $(this);
        jQObj.addClass("qt3script-revealed").removeClass("qt3script-hidden");
    }
    
    function revealHiddenAside()
    {
        var jQObj = $(this);
        jQObj.addClass("qt3script-revealed").removeClass("qt3script-hidden");
    }
    
    function hideMutedUserPosts()
    {
        // Using Fishbreath's styles from https://forum.quartertothree.com/t/the-stylish-user-css-library-wiki-post/120128
        
        $("article").each(function() {
            var jQObj = $(this);
            if (!jQObj.find("div.contents").hasClass("qt3script-revealed"))
            {
                var postUsername = jQObj.find("a[data-user-card]").attr("data-user-card");
				if ($.inArray(postUsername,mutedUsernames)>=0)
				{
					jQObj.find("div.contents").addClass("qt3script-hidden").addClass("qt3script-mute");
					jQObj.find("div.contents").click(revealHiddenPost);
                    // this would need it's own $("aside").each() thing like the article one just above
                    //$("aside div.title:contains('"+postUsername+"')").parent().addClass("qt3script-hidden").click(revealHiddenPost);
				}
            }
        });
        
        $("aside[data-post]").each(function() {
            var jQObj = $(this);
            if (!jQObj.hasClass("qt3script-revealed"))
            {
                var asideUsername = $.trim(jQObj.find("div.title").text());
                // remove ":" character
                asideUsername = asideUsername.substr(0,asideUsername.length-1);
                if ($.inArray(asideUsername,mutedUsernames)>=0)
				{
                    jQObj.addClass("qt3script-hidden").addClass("qt3script-mute");
					jQObj.click(revealHiddenAside);
                }
            }
        });
    }
    
    function addUserToIgnoreList(usernameToMute)
    {
        mutedUsernames.push(usernameToMute);
        var mutedUserNamesDataObj = {muted_usernames: mutedUsernames.join()};
        $.ajax({
            data: mutedUserNamesDataObj,
            url: userJsonURL,
            method: "put"
        });
        hideMutedUserPosts();
    }
    
    function saveCustomCss(newCustomCss,force)
    {
        if ((force===true) || (newCustomCss != customCss))
        {
            logToConsole("saving new custom css:" + newCustomCss);
            var customCssDataObj = {user_fields: {}};
            customCssDataObj.user_fields[customCssFieldNum] = newCustomCss;
            $.ajax({
                data: customCssDataObj,
                url: userJsonURL,
                method: "put"
            }).done(function() {location.reload();});
        }
    }
    
    function muteBtnClick(a,b,c)
    {
        addUserToIgnoreList($('div#user-card h1.username a').text().trim());
    }
    
    function addMuteButtonToUserCard(a,b,c)
    {
        jQMuteBtn = $('<li><a class="btn btn-warning"><i class="fa fa-ban"></i>Mute User</a></li>').click(muteBtnClick);
        $('ul.usercard-controls').append(jQMuteBtn);
    }
    
    function saveThemeSelection()
    {
        var selectedThemeValue = parseInt($("#qt3script-theme-select option:selected").val());
        window.setTimeout(function() {saveCustomCss(themeCssList[selectedThemeValue]);},500);
    }
    
    function addThemePrefsToPrefsPage()
    {
        if ($("section.user-preferences form div.muting").length>0)
        {
            
            
            logToConsole("ready to add theme controls");
            var themeDD = $("<div class='control-group pref-theme'><label class='control-label'>Themes</label><div class='controls'><select id='qt3script-theme-select'><option value='0'>Normal</option><option value='1'>Night theme</option></select></div></div>");
            $("section.user-preferences form div.muting").after(themeDD);
            var themeSel2 = themeDD.find("select").select2();
            themeSel2.change(function(evt){ $("div.user-field:nth(8) input").val(themeCssList[evt.val]);  });
            $("button.save-user").click(saveThemeSelection);
            
            if (customCss != null)
            {
                var customCssListIndex = $.inArray(customCss,themeCssList);
                if (customCssListIndex>=0) {
                    $("#qt3script-theme-select").select2("val",customCssListIndex);
                }
            }
        }
        else {
            // poor man's page load timer
            logToConsole("not ready to add theme controls");
            window.setTimeout(addThemePrefsToPrefsPage,1000);
        }
    }
    
    function usercardMutationHandler(mutationRecords) 
    {
        $(document).trigger("qt3script:userCardChanged");
        logToConsole("qt3script:userCardChanged");
    }
    
    function postsMutationHandler(mutationRecords) 
    {
        $(document).trigger("qt3script:postsChanged");
        logToConsole("qt3script:postsChanged");
    }
    
    function mainOutletMutationHandler(mutationRecords) 
    {
        $(document).trigger("qt3script:mainOutletChanged");
        logToConsole("qt3script:mainOutletChanged");
    }
    
    function setupMutationObservers()
    {
        if (usercardObserver) {
            usercardObserver.disconnect();
            usercardObserver = null;
        }
        if ($('div#user-card').length>0)
        {
            usercardObserver = new MutationObserver(usercardMutationHandler);
            usercardObserver.observe($('div#user-card')[0], { childList: true});
        }
        
        if (postsObserver) {
            postsObserver.disconnect();
            postsObserver = null;
        }
        if ($('div.posts-wrapper').length>0)
        {
            postsObserver = new MutationObserver(postsMutationHandler);
            postsObserver.observe($('div.posts-wrapper')[0], { childList: true, subtree: true});
        }
        
        
        
    }
    
    function logToConsole(logStr,force)
    {
        if ((force || enableConsoleOutput) && console) console.log("qt3script: " + logStr);
    }
    
    function isPreferencesPage()
    {
        logToConsole("checking for prefs page");
        if (window.location.href.indexOf("/preferences")>0)
        {
            return true;
        }
        
        return false;
    }
    
    function checkForNewPage()
    {
        if (window.location.href !== lastWindowHref)
        {
            if (lastWindowHref && window.location.href.indexOf('/t/')>=0 && lastWindowHref.indexOf('/t/')>=0)
            {
                // posts changes url a lot, but it's not a new page (except sometimes?)
                lastWindowHref = window.location.href;
            }
            else 
            {
                $(document).trigger("qt3script:newPageLoaded");
                logToConsole("qt3script:newPageLoaded");
                lastWindowHref = window.location.href;
            }
        }
        
        // need to do this better, obviously
        if (!postsObserver && $('div.posts-wrapper').length>0)
        {
            postsObserver = new MutationObserver(postsMutationHandler);
            postsObserver.observe($('div.posts-wrapper')[0], { childList: true, subtree: true});
        }
    }
    
    function newPageLoaded()
    {
        username = $("#current-user img").attr("title");
        userJsonURL = "/users/"+username+".json";
        
        if (isPreferencesPage())
        {
            logToConsole("prefs page land");
            addThemePrefsToPrefsPage();
        }
        
        setupMutationObservers();
        hideMutedUserPosts();
    }
    
    function handleScrollEvent()
    {
        return false;
    }
    
    function killScrolling()
    {
        logToConsole("adding scroll handler");  
        $(document).on("scroll", handleScrollEvent);
        window.setTimeout(function() 
          {
            logToConsole("removing scroll handler"); 
            $(document).off("scroll",handleScrollEvent);
          },1500); 
        $(document).scroll();
    }
    
    function iframeTracker(jqObj)
    {
        jqObj.iframeTracker({
            blurCallback: function(){
                // Do something when iframe is clicked (like firing an XHR request)
                // You can know which iframe element is clicked via this._overId
                logToConsole('iframe clicked');
                killScrolling();
            }/*,
            overCallback: function(element){
                this._overId = $(element).parents('.iframe_wrap').attr('id'); // Saving the iframe wrapper id
            },
            outCallback: function(element){
                this._overId = null; // Reset hover iframe wrapper id
            },
            _overId: null*/
        });
    }
    
    function iframeTrackingTester() {
        var newTrackedIframes = [];
        $("iframe").each(
            //if not in trackediframes, add to new trackediframes
            function() {
                var postId = $(this).parents("article").attr("data-post-id");
                var YtId = $(this).parent().attr("data-youtube-id");
                
                if (!postId || !YtId) return;
                
                // turn off autoplay?
                var src = $(this).attr("src");
                var autoplayPos = src.indexOf("autoplay=1");
                if (autoplayPos<0) autoplayPos = null;
                else autoplayPos += 9;
                
                if (autoplayPos!==null) {
                    src = src.substr(0,autoplayPos) + "0" + src.substr(autoplayPos+1);
                    $(this).attr("src",src);
                }
                
                
                
                if (!trackedIframes || $.inArray(postId+"-"+YtId, trackedIframes)<0) {
                  newTrackedIframes.push($(this));
                  trackedIframes.push(postId+"-"+YtId);
                }
            }
        );
        
        $.each(newTrackedIframes,function(index,val) {iframeTracker(val); });
        
        // make sure all those tracked iframe keys still have the corresponding videos on the page, since a long scroll can remove them from the DOM
        var removeTrackingOn = [];
        $.each(trackedIframes,function(index,val) { 
            var dashLoc = val.indexOf("-");
            var postId = val.substr(0,dashLoc);
            var YtId = val.substr(dashLoc+1);
            if ($("article[data-post-id='"+postId+"']").find("div[data-youtube-id='"+YtId+"']").length<=0)
            {
                // remove this tracked iframe
                removeTrackingOn.push(val);
            }
        });
  
        if (removeTrackingOn.length>0)
        {
            trackedIframes = trackedIframes.filter( function( el ) {
                return removeTrackingOn.indexOf( el ) < 0; });
        }
    }
    
    function init() {
        if ($("#main-outlet").length>0)
        {
            mainOutletObserver = new MutationObserver(mainOutletMutationHandler);
            mainOutletObserver.observe($("#main-outlet")[0], { childList: true});
        }
        
        logToConsole("init");
        username = $("#current-user img").attr("title");
        userJsonURL = "/users/"+username+".json";
        
        
        
        
        
        jQMuteBtn = $('<li><a class="btn btn-warning"><i class="fa fa-ban"></i>Mute User</a></li>').click(muteBtnClick);
        
        $(document).on("qt3script:gotMutedUserNames", hideMutedUserPosts);
        $(document).on("qt3script:gotCustomCss", loadCustomCss);
        $(document).on("qt3script:postsChanged", hideMutedUserPosts);
        $(document).on("qt3script:postsChanged", iframeTrackingTester);
        $(document).on("qt3script:userCardChanged",addMuteButtonToUserCard);
        $(document).on("qt3script:newPageLoaded",newPageLoaded);
        //$(document).on("qt3script:mainOutletChanged",checkForNewPage);
        //$(document).on("qt3script:mainOutletChanged",function() {$(document).trigger("qt3script:newPageLoaded");});
        
        
        // ugh, sorry
        window.setInterval(checkForNewPage,500);
        
        //newPageLoaded();
        
        $.getJSON(userJsonURL, gotUserJson);
    }
    
    // don't wait for ready to add these scripts/css?
    // load iframe tracking js
        $('head').append('<script src="' + iframeTrackingUrl + '" ></script>');
    
    // load css for muting users
        $('head').append('<link rel="stylesheet" href="' + scriptCssUrl + '" type="text/css" />');
    
    $(function(){init();});
})();
