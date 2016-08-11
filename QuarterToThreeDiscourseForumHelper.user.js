// ==UserScript==
// @name         QuarterToThree Discourse Forum Helper
// @namespace    https://github.com/matthewboonstra/qt3UserScript/
// @version      0.31
// @description  A User Script for the new QuarterToThree forum on Discourse.
// @author       arrendek
// @match        *://forum.quartertothree.com/*
// @grant        none
// @downloadURL  https://github.com/matthewboonstra/qt3UserScript/raw/master/QuarterToThreeDiscourseForumHelper.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    var scriptCssUrl = "https://raw.githubusercontent.com/matthewboonstra/qt3UserScript/master/qt3Script.css";
    
    var normalThemeCss = "";
    var nightThemeCss = "http://198.199.78.220/qt3NightTheme.css";
    var themeCssList = [normalThemeCss, nightThemeCss];
    
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    var username;
    var mutedUsernames;
    var userJsonURL;
    var customCss;
    var enableConsoleOutput = false;
    
    var lastWindowHref;
    
    var usercardObserver, postsObserver, mainOutletObserver;
    
    var jQMuteBtn;
    
    function gotUserJson(data)
    {
        mutedUsernames = data.user.muted_usernames;
        customCss = data.user.user_fields[9];
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
                debugger;
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
    
    function hideMutedUserPosts()
    {
        // Using Fishbreath's styles from http://forum.quartertothree.com/t/the-stylish-user-css-library-wiki-post/120128
        
        $("article").each(function() {
            var jQObj = $(this);
            var postUsername = jQObj.find("a[data-user-card]").attr("data-user-card");
            if (!jQObj.find("div.contents").hasClass("qt3script-revealed"))
            {
				if ($.inArray(postUsername,mutedUsernames)>=0)
				{
					jQObj.find("div.contents").addClass("qt3script-hidden").addClass("qt3script-mute");
					jQObj.find("div.contents").click(revealHiddenPost);
                    // this would need it's own $("aside").each() thing like the article one just above
                    //$("aside div.title:contains('"+postUsername+"')").parent().addClass("qt3script-hidden").click(revealHiddenPost);
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
    
    function saveCustomCss(newCustomCss)
    {
        if (newCustomCss != customCss)
        {
            logToConsole("saving new custom css:" + newCustomCss);
            var customCssDataObj = {user_fields: {9: newCustomCss}};
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
    
    function logToConsole(logStr)
    {
        if (enableConsoleOutput && console) console.log("qt3script: " + logStr);
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
    
    function init() {
        if ($("#main-outlet").length>0)
        {
            mainOutletObserver = new MutationObserver(mainOutletMutationHandler);
            mainOutletObserver.observe($("#main-outlet")[0], { childList: true});
        }
        
        logToConsole("init");
        username = $("#current-user img").attr("title");
        userJsonURL = "/users/"+username+".json";
        
        // load css for muting users
        $('head').append('<link rel="stylesheet" href="' + scriptCssUrl + '" type="text/css" />');
        
        jQMuteBtn = $('<li><a class="btn btn-warning"><i class="fa fa-ban"></i>Mute User</a></li>').click(muteBtnClick);
        
        $(document).on("qt3script:gotMutedUserNames", hideMutedUserPosts);
        $(document).on("qt3script:gotCustomCss", loadCustomCss);
        $(document).on("qt3script:postsChanged", hideMutedUserPosts);
        $(document).on("qt3script:userCardChanged",addMuteButtonToUserCard);
        $(document).on("qt3script:newPageLoaded",newPageLoaded);
        //$(document).on("qt3script:mainOutletChanged",checkForNewPage);
        //$(document).on("qt3script:mainOutletChanged",function() {$(document).trigger("qt3script:newPageLoaded");});
        
        // ugh, sorry
        window.setInterval(checkForNewPage,500);
        
        //newPageLoaded();
        
        $.getJSON(userJsonURL, gotUserJson);
    }
    
    $(function(){init();});
})();
