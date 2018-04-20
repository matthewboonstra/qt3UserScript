// ==UserScript==
// @name         QuarterToThree Discourse Forum Helper
// @namespace    https://github.com/matthewboonstra/qt3UserScript/
// @version      0.38.1
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
    
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    var username;
    var mutedUsernames;
    var userJsonURL;
    var enableConsoleOutput = false;
    var customCssFieldNum = 10;
    var ignorePostsChanged = false;

    var userOptions;
    
    var lastWindowHref;
    var usercardObserver, postsObserver, mainOutletObserver;
    
    var windowHeight, windowWidth;

    var prefsPageAttemptNum = 0;
  
    // utilities
    function logToConsole(logStr,force)
    {
        if ((force || enableConsoleOutput) && console) console.log("qt3script: " + logStr);
    }

    // main functions
    function gotUserJson(data)
    {
        mutedUsernames = data.user.muted_usernames;
        userOptions = data.user.user_fields[customCssFieldNum];
        
        $(document).trigger("qt3script:gotMutedUserNames");
        $(document).trigger("qt3script:gotUserOptions");
    }

    function loadUserOptions()
    {
        logToConsole(userOptions);
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

    function userIsMuted(username)
    {
        return $.inArray(username,mutedUsernames)>=0;
    }
    
    function hideMutedUserPosts()
    {
        $("article").each(function() {
            var jQObj = $(this);
            if (!jQObj.find("div.contents").hasClass("qt3script-revealed"))
            {
                var postUsername = jQObj.find("a[data-user-card]").attr("data-user-card");
				if (userIsMuted(postUsername))
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
                if (userIsMuted(asideUsername))
				{
                    jQObj.addClass("qt3script-hidden").addClass("qt3script-mute");
					jQObj.click(revealHiddenAside);
                }
            }
        });
    }

    function unmutePostsByUser(usernameToUnMute)
    {
        $("article:has(div.qt3script-mute)").each(function() {
            var jQObj = $(this);
            var postUsername = jQObj.find("a[data-user-card]").attr("data-user-card");
            if (postUsername===usernameToUnMute)
            {
                jQObj.find("div.contents").removeClass("qt3script-hidden").removeClass("qt3script-mute").removeClass("qt3script-revealed");
            }
        });

        $("aside[data-post]").each(function() {
            var jQObj = $(this);
            var asideUsername = $.trim(jQObj.find("div.title").text());
            // remove ":" character
            asideUsername = asideUsername.substr(0,asideUsername.length-1);
            if (asideUsername===usernameToUnMute)
            {
                jQObj.removeClass("qt3script-hidden").removeClass("qt3script-mute").removeClass("qt3script-revealed");
            }
        });
    }
    
    function saveUserOptions(newUserOptions,force)
    {
        if ((force===true) || (newUserOptions != userOptions))
        {
            logToConsole("saving new user options: " + newUserOptions);
            var userOptionsDataObj = {user_fields: {}};
            userOptionsDataObj.user_fields[customCssFieldNum] = newUserOptions;
            $.ajax({
                data: userOptionsDataObj,
                url: userJsonURL,
                method: "put"
            }).done(function() {location.reload();});
        }
    }
    
    function muteBtnClick()
    {
        addUserToIgnoreList($('div#user-card h1.username a').text().trim());
        removeMuteButtonFromUserCard();
        addMuteButtonToUserCard();
    }

    function unmuteBtnClick()
    {
        removeUserFromIgnoreList($('div#user-card h1.username a').text().trim());
        removeMuteButtonFromUserCard();
        addMuteButtonToUserCard();
    }

    function saveMutedUsernames(successFn)
    {
        var mutedUserNamesDataObj = {muted_usernames: mutedUsernames.join()};
        $.ajax({
            data: mutedUserNamesDataObj,
            url: userJsonURL,
            method: "put",
            success: successFn
        });
    }

    function addUserToIgnoreList(usernameToMute)
    {
        mutedUsernames.push(usernameToMute);
        saveMutedUsernames(hideMutedUserPosts);
    }

    function removeUserFromIgnoreList(usernameToUnMute)
    {
        if (!userIsMuted(usernameToUnMute)) return;

        mutedUsernames = $.grep(mutedUsernames, function(uname) { return uname !== usernameToUnMute; });
        saveMutedUsernames(function () {unmutePostsByUser(usernameToUnMute); });
    }

    function removeMuteButtonFromUserCard()
    {
        $('div#user-card .qt3script-button.qt3script-muting').remove();
    }
    
    function addMuteButtonToUserCard()
    {
        var jQMuteBtn = $('<li class="qt3script-button qt3script-muting"><a class="btn btn-warning"><i class="fa fa-ban"></i>Mute User</a></li>').click(muteBtnClick);
        var jQUnMuteBtn = $('<li class="qt3script-button qt3script-muting"><a class="btn btn-warning"><i class="fa fa-ban"></i>Unmute User</a></li>').click(unmuteBtnClick);

        $('div#user-card').each(function() {
            var userCardObj = $(this);
            var uname = userCardObj.find('h1.username a').text().trim();
            var btnToAppend = userIsMuted(uname)?jQUnMuteBtn:jQMuteBtn;
            userCardObj.find('ul.usercard-controls').append(btnToAppend);
        });
    }

    /*
    function saveThemeSelection()
    {
        var selectedThemeValue = parseInt($("#qt3script-theme-select option:selected").val());
        window.setTimeout(function() {saveUserOptions(themeCssList[selectedThemeValue]);},500);
    }
    */

    function revealPrefsScriptOptionsPanel()
    {
        $("form#qt3script-optionsform").css("display","block");
    }

    function hidePrefsScriptOptionsPanel()
    {
        $("form#qt3script-optionsform").css("display","none");
    }

    function createPrefsScriptOptionsPanel()
    {
        var userScriptOptionsPrefsForm = $('<form id="qt3script-optionsform" style="display:none" class="form-vertical" style=""><div class="control-group pref-userscriptoptions"><label class="control-label">User Script Options</label></form>');
        var controls = [];
        controls[0] = '<div class="controls controls-dropdown"><label>Coming Sooner or Later, options!</label><select id="qt3script-theme-select"><option value="0">Normal</option><option value="1">Normaler</option></select><div class="select-kit-wrapper" style="width: 220px; height: 31.6px;"></div></div>';
        userScriptOptionsPrefsForm.append(controls);
        //$.each(controls, function(index,control) { userScriptOptionsPrefsForm.append(control); });

        var prefsRightPanel = $("section.user-right.user-preferences");
        prefsRightPanel.append(userScriptOptionsPrefsForm);
        //userScriptOptionsPrefsForm.find("select").select2();
        /*
        var themeDD = $("<div class='control-group pref-theme'><label class='control-label'>Themes</label><div class='controls'><select id='qt3script-theme-select'><option value='0'>Normal</option><option value='1'>Night theme</option></select></div></div>");
        $("section.user-preferences form div.muting").after(themeDD);
        var themeSel2 = themeDD.find("select").select2();
        themeSel2.change(function(evt){ $("div.user-field:nth(8) input").val(themeCssList[evt.val]);  });
        */
        //$("button.save-user").click(saveThemeSelection);

        if (userOptions !== null)
        {
            /*var customCssListIndex = $.inArray(customCss,themeCssList);
                if (customCssListIndex>=0) {
                    $("#qt3script-theme-select").select2("val",customCssListIndex);
                }*/
        }
    }

    function scriptOptionsNavClick()
    {
        var prefsNavPanel = $("section.user-navigation .preferences-nav");
        prefsNavPanel.find("li a").removeClass("active");
        prefsNavPanel.find("li a#qt3script-scriptoptions-link").addClass("active");

        var prefsRightPanel = $("section.user-right.user-preferences");
        prefsRightPanel.children().css("display","none");
        revealPrefsScriptOptionsPanel();
        return false;
    }

    function prefsNavPanelClick()
    {
        // clear out changes to nav panel from options click
        $(this).find("li a#qt3script-scriptoptions-link").removeClass("active");
        var prefsRightPanel = $("section.user-right.user-preferences");
        prefsRightPanel.children().css("display","");
        hidePrefsScriptOptionsPanel();
    }

    function addScriptOptionsNavToPrefsPage()
    {
        var prefsNavPanel = $("section.user-navigation .preferences-nav");
        if (prefsNavPanel.length>0)
        {
            prefsPageAttemptNum = 0;
            if (prefsNavPanel.find('li.nav-qt3script-scriptoptions').length>0) return;
            logToConsole("ready to add script options pref panel");
            prefsNavPanel.click(prefsNavPanelClick);
            var scriptOptionsNavEl = $('<li class="nav-qt3script-scriptoptions"><a href="/u/'+username+'/preferences/userscriptoptions" id="qt3script-scriptoptions-link">Qt3 User Script Options</span></li>').click(scriptOptionsNavClick);
            prefsNavPanel.append(scriptOptionsNavEl);
            createPrefsScriptOptionsPanel();
        }
        else {
            // poor man's page load timer
            if (prefsPageAttemptNum<10)
            {
                logToConsole("not ready to add theme controls");
                prefsPageAttemptNum++;
                window.setTimeout(addScriptOptionsNavToPrefsPage,500);
            }
            else {
                logToConsole("prefs page add options failed");
            }
        }
    }
    
    function usercardMutationHandler(mutationRecords) 
    {
        $(document).trigger("qt3script:userCardChanged");
        logToConsole("qt3script:userCardChanged");
    }
    
    function postsMutationHandler(mutationRecords) 
    {
        if (!ignorePostsChanged)
        {
            $(document).trigger("qt3script:postsChanged");
            logToConsole("qt3script:postsChanged");
        }
        else {
            logToConsole("[ignored] qt3script:postsChanged");
        }
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
            addScriptOptionsNavToPrefsPage();
        }
        
        setupMutationObservers();
        hideMutedUserPosts();
    }
    
    function replaceDateTimeStamp()
    {
        //$(".post-info span.relative-date").not(".qt3script-datefix").each(function() {$(this).addClass("qt3script-datefix").text($(this).attr("title"));});
        $(".post-info span.relative-date").not(":has(span.qt3script-dfspan)").each(function() {$(this).addClass("qt3script-datefix").html("<span class='qt3script-dfspan'>" + $(this).attr("title") + "</span>");});
    }
    
    function init() {
	// load css for muting users
        $('head').append('<link rel="stylesheet" href="' + scriptCssUrl + '" type="text/css" />');
	    
        if ($("#main-outlet").length>0)
        {
            mainOutletObserver = new MutationObserver(mainOutletMutationHandler);
            mainOutletObserver.observe($("#main-outlet")[0], { childList: true});
        }
        
        logToConsole("init");
        username = $("#current-user img").attr("title");
        userJsonURL = "/users/"+username+".json";
        replaceDateTimeStamp();

        $(document).on("qt3script:postsChanged", hideMutedUserPosts);
        $(document).on("qt3script:postsChanged", replaceDateTimeStamp);

        $(document).on("qt3script:userCardChanged",addMuteButtonToUserCard);
        $(document).on("qt3script:gotMutedUserNames", hideMutedUserPosts);
        $(document).on("qt3script:gotUserOptions", loadUserOptions);

        $(document).on("qt3script:newPageLoaded",newPageLoaded);
        $(document).on("qt3script:newPageLoaded",replaceDateTimeStamp);

        //$(document).on("qt3script:mainOutletChanged",checkForNewPage);
        //$(document).on("qt3script:mainOutletChanged",function() {$(document).trigger("qt3script:newPageLoaded");});
        
        // ugh, sorry
        window.setInterval(checkForNewPage,500);
        
        //newPageLoaded();
        
        $.getJSON(userJsonURL, gotUserJson);

        // ugh, double sorry
        //window.setTimeout(setupResizeObserver,200);
    }
  
    function waitForJQuery() {
        if ($) {
            clearInterval(waitForJQueryInterval);

            $(function(){init();});
        }
    }

    var waitForJQueryInterval = setInterval(waitForJQuery,500);
})();
