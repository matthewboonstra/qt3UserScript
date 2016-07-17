// ==UserScript==
// @name         QuarterToThree Discourse Forum Helper
// @namespace    http://forum.quartertothree.com
// @version      0.3
// @description  A User Script for the new QuarterToThree forum on Discourse.
// @author       arrendek
// @match        http*://forum.quartertothree.com/t/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var username;
    var mutedUsernames;
    var userJsonURL;
    var jQMuteBtn;
    var customCss;
    
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
            if (!jQObj.hasClass("qt3script-revealed"))
            {
				if ($.inArray(postUsername,mutedUsernames)>=0)
				{
					jQObj.addClass("qt3script-hidden").addClass("qt3script-mute");
                    //jQObj.find("code").css("background-color","transparent").css("color","transparent").css("text-shadow","0px 0px 10px gray").addClass("qt3script-hidden");
					jQObj.click(revealHiddenPost);
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
        var customCssDataObj = {user_fields: {9: newCustomCss}};
        $.ajax({
            data: customCssDataObj,
            url: userJsonURL,
            method: "put"
        });
    }
    
    function muteBtnClick(a,b,c)
    {
        addUserToIgnoreList($('div#user-card h1.username a').text().trim());
    }
    
    function addMuteButtonToUserCard(a,b,c)
    {
        $('ul.usercard-controls').append(jQMuteBtn);
    }
    
    function usercardMutationHandler (mutationRecords) 
    {
        $(document).trigger("qt3script:userCardChanged");
    }
    
    function postsMutationHandler (mutationRecords) 
    {
        $(document).trigger("qt3script:postsChanged");
    }
    
    function setupMutationObservers()
    {
        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
        var usercardObserver = new MutationObserver (usercardMutationHandler);
        var postsObserver = new MutationObserver (postsMutationHandler);
        usercardObserver.observe($('div#user-card')[0], { childList: true, subtree: true});
        postsObserver.observe($('div.posts-wrapper')[0], { childList: true, subtree: true});
    }
    
    function init() {
        username = $("#current-user img").attr("title");
        userJsonURL = "/users/"+username+".json";
        
        /*origBGColor = $("article").css("background-color");
        origColor = $("article").css("color");
        origTextShadow = $("article").css("text-shadow");*/
        
        jQMuteBtn = $('<li><a class="btn btn-warning"><i class="fa fa-ban"></i>Mute User</a></li>').click(muteBtnClick);
        
        // load css for muting users
        $('head').append('<link rel="stylesheet" href="http://198.199.78.220/qt3Script.css" type="text/css" />');
        saveCustomCss("http://198.199.78.220/qt3NightTheme.css");
        
        setupMutationObservers();
        
        $(document).on("qt3script:gotMutedUserNames", hideMutedUserPosts);
        $(document).on("qt3script:gotCustomCss", loadCustomCss);
        $(document).on("qt3script:postsChanged", hideMutedUserPosts);
        $(document).on("qt3script:userCardChanged",addMuteButtonToUserCard);
        //$(document).on("qt3script:postsChanged", function() {if (console) console.log("posts change detected");});
        
        $.getJSON(userJsonURL, gotUserJson);
    }
    
    $(function(){init();});
})();